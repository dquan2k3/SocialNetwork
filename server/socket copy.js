const { Server } = require("socket.io");
const redis = require("./src/config/redis");
import jwt from "jsonwebtoken";
import { getGroupConversation, sendMessageHandler, sendGroupMessageHandler } from "./src/controller/conversation";

let io = null;

// Giải mã token từ cookie
function decodeUserFromCookie(cookieString) {
    if (!cookieString) return null;
    try {
        const cookiesArr = cookieString.split(';').map(c => c.trim());
        const tokenCookie = cookiesArr.find(item => item.startsWith('token='));
        if (!tokenCookie) return null;
        const token = tokenCookie.replace('token=', '');
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
}

// Tối ưu: sử dụng hàm tiện ích để xóa user khỏi map bằng socketId (tránh lặp code)
function removeUserBySocket(userSockets, socketId) {
    for (const [userId, sockId] of userSockets.entries()) {
        if (sockId === socketId) {
            userSockets.delete(userId);
            break;
        }
    }
}

function registerSocket(server) {
    io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:3000",
            methods: ["GET", "POST", "PUT", "DELETE"],
            credentials: true
        }
    });

    if (io) {
        console.log("[socket.io] Socket server initialized thành công 🚀");
    } else {
        console.error("[socket.io] Lỗi khi khởi tạo socket server!");
    }

    // Map userId -> socketId
    const userSockets = new Map();

    io.on("connection", (socket) => {
        console.log("A user connected:", socket.id);

        socket.on("userConnect", async (name) => {
            socket.data.name = name;
            const cookies = socket.handshake.headers.cookie;
            const decoded = decodeUserFromCookie(cookies);
            const userId = decoded?.id;
            if (!userId) {
                console.warn("[userConnect] Không tìm thấy userId từ token trong cookie!");
                return;
            }
            userSockets.set(userId, socket.id);
            socket.userId = userId;

            socket.join(userId);

            // Join tất cả group conversation cho user
            try {
                const groupIdList = await getGroupConversation(userId);
                if (Array.isArray(groupIdList)) {
                    groupIdList.forEach(group => {
                        if (group.conversationId) {
                            socket.join(group.conversationId);
                        }
                    });
                }
            } catch (err) {
                console.error("Lỗi khi join group conversations:", err);
            }
        });

        socket.on("disconnect", () => {
            if (socket.userId) {
                userSockets.delete(socket.userId);
            } else {
                removeUserBySocket(userSockets, socket.id);
            }
        });

        socket.on("sendMessage", async (data) => {
            try {
                const senderId = socket.userId;
                const { receiverId, message } = data;
                let { conversationId } = data;
                console.log("[sendMessage] received:", { senderId, receiverId, message, conversationId });

                if (!senderId || !receiverId || !message) {
                    socket.emit("messageError", { error: "Thiếu senderId, receiverId hoặc message" });
                    return;
                }

                let result;
                try {
                    result = await sendMessageHandler({ senderId, receiverId, message, conversationId });
                } catch (err) {
                    socket.emit("messageError", {
                        error: err?.message || "Failed to save message"
                    });
                    return;
                }

                // Nếu client không kèm conversationId, lấy từ sendMessageHandler
                if (!conversationId && result.conversationId) {
                    conversationId = result.conversationId;
                }

                let sendData = {
                    senderId: result.senderId,
                    message: result.message,
                    createdAt: result.createdAt,
                    ...(conversationId && { conversationId })
                };

                const receiverSocketId = userSockets.get(receiverId);

                console.log(receiverSocketId);

                // Gửi messageNotification cho cả sender và receiver với dữ liệu tin nhắn (private)
                if (receiverSocketId) {
                    socket.to(receiverSocketId).emit("receiveMessage", sendData);
                    // Gửi lại cho sender nếu có conversationId (giúp đồng bộ giao diện)
                    if (conversationId) {
                        socket.emit("receiveMessage", { ...sendData, receiverId });
                    }
                    // Thông báo notification cho cả 2:
                    socket.emit("messageNotification", {
                        type: "private",
                        ...sendData,
                        peerUserId: receiverId,
                        conversationId, // trả conversationId cho thông báo
                    });
                    socket.to(receiverSocketId).emit("messageNotification", {
                        type: "private",
                        ...sendData,
                        peerUserId: senderId,
                        conversationId, // trả conversationId cho thông báo
                    });
                } else {
                    // Nếu receiver offline vẫn gửi notification cho sender
                    socket.emit("messageError", {
                        error: "User not online",
                        receiverId
                    });
                    socket.emit("messageNotification", {
                        type: "private",
                        ...sendData,
                        peerUserId: receiverId,
                        conversationId, // trả conversationId cho thông báo
                    });
                }

                socket.emit("messageSent", { success: true, data: sendData });

            } catch (error) {
                socket.emit("messageError", { error: "Failed to send message" });
            }
        });

        socket.on("joinRoom", (roomId) => {
            socket.join(roomId);
            socket.emit("roomJoined", { roomId, success: true });
        });

        socket.on("leaveRoom", (roomId) => {
            socket.leave(roomId);
            socket.emit("roomLeft", { roomId, success: true });
        });

        socket.on("sendRoomMessage", async (data) => {
            try {
                // Gửi tin nhắn cho tất cả thành viên group ngoại trừ sender
                socket.to(data.roomId).emit("receiveRoomMessage", data);

                // Lưu ý: hàm sendGroupMessageHandler trả về gì thì tuỳ bạn (có thể bổ sung gắn id hoặc dữ liệu bổ sung)
                // Thực hiện lưu message group (thường là không cần await nếu không trả về dữ liệu, nhưng để chắc chắn cập nhật nội dung gửi đi)
                let savedMessage;
                try {
                    savedMessage = await sendGroupMessageHandler({
                        roomId: data.roomId,
                        senderId: socket.userId,
                        message: data.message
                    });
                } catch (err) {
                    socket.emit("messageError", { error: "Failed to save group message" });
                    return;
                }

                // Thông báo messageNotification cho tất cả thành viên (bao gồm cả người gửi):
                // Lấy tất cả socket trong room (bao gồm cả sender)
                const room = io.sockets.adapter.rooms.get(data.roomId) || new Set();
                const notificationData = {
                    type: "group",
                    senderId: socket.userId,
                    message: data.message,
                    createdAt: savedMessage?.createdAt || new Date(),
                    conversationId: data.roomId // luôn trả conversationId
                };

                // Gửi event đến từng socketId trong room
                for (const socketId of room) {
                    const targetSocket = io.sockets.sockets.get(socketId);
                    if (targetSocket) {
                        targetSocket.emit("messageNotification", notificationData);
                    }
                }

                socket.emit("messageSent", { success: true, data: notificationData });
            } catch (error) {
                socket.emit("messageError", { error: "Failed to send room message" });
            }
        });
    });
}

function getIO() {
    return io;
}

module.exports = {
    registerSocket,
    getIO,
    decodeUserFromCookie
};
