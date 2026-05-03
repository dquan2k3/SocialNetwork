const { Server } = require("socket.io");
const redis = require("./src/config/redis");
const jwt = require("jsonwebtoken");

// Lazy load các controller để tránh circular dependency
// Chỉ require khi thực sự cần sử dụng
let conversationModule = null;
let authModule = null;

function getConversationModule() {
    if (!conversationModule) {
        try {
            conversationModule = require("./src/controller/conversation");
        } catch (err) {
            console.error("[socket.js] Lỗi khi require conversation controller:", err.message);
        }
    }
    return conversationModule;
}

function getAuthModule() {
    if (!authModule) {
        try {
            authModule = require("./src/controller/auth");
        } catch (err) {
            console.error("[socket.js] Lỗi khi require auth controller:", err.message);
        }
    }
    return authModule;
}

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

function registerSocket(server) {
    console.log("[registerSocket] Đang khởi tạo socket server...");
    io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:3000",
            methods: ["GET", "POST", "PUT", "DELETE"],
            credentials: true
        }
    });

    if (io) {
        console.log("[socket.io] Socket server initialized thành công 🚀");
        console.log("[registerSocket] io instance:", !!io);
    } else {
        console.error("[socket.io] Lỗi khi khởi tạo socket server!");
    }

    io.on("connection", (socket) => {
        console.log("A user connected:", socket.id);

        // ------- userConnect -------
        socket.on("userConnect", async (name) => {
            socket.data.name = name;

            const cookies = socket.handshake.headers.cookie;
            const decoded = decodeUserFromCookie(cookies);
            const userId = decoded?.id;
            const avatar = decoded?.avatar;

            if (!userId) {
                console.warn("[userConnect] Không tìm thấy userId từ cookie");
                return;
            }

            socket.userId = userId;
            socket.avatar = avatar;

            // Lưu socketId đa tab
            await redis.sAdd(`user:${userId}:sockets`, socket.id);
            // Đánh dấu user online
            await redis.sAdd("online_users", userId);
            // Join phòng riêng user
            socket.join(userId);

            // Join group conversations
            try {
                const convModule = getConversationModule();
                if (convModule && convModule.getGroupConversation) {
                    const groupIdList = await convModule.getGroupConversation(userId);
                    if (Array.isArray(groupIdList)) {
                        groupIdList.forEach(group => {
                            if (group.conversationId) {
                                socket.join(group.conversationId);
                            }
                        });
                    }
                }
            } catch (err) {
                console.error("Lỗi join group conversations:", err);
            }

            const socketCount = await redis.sCard(`user:${userId}:sockets`);
            console.log("socketCount : ", socketCount)
            if (socketCount === 1) {
                console.log(`[ONLINE] User online: ${userId}`);
                // Gửi sự kiện ONLINE_USER với data về user vừa online, truyền thêm avatar
                const authMod = getAuthModule();
                if (authMod && authMod.updateLastSeen2126) {
                    authMod.updateLastSeen2126(userId);
                }
                io.emit("onlineUser", {
                    userId,
                    name: socket.data.name,
                    type: "online",
                    avatar: avatar
                });
            }
        });

        // ------- disconnect -------
        socket.on("disconnect", async () => {
            const userId = socket.userId;
            const avatar = socket.avatar;
            if (!userId) return;

            // Xóa socketId này khỏi user
            await redis.sRem(`user:${userId}:sockets`, socket.id);
            // Kiểm tra còn socket nào không
            const remain = await redis.sCard(`user:${userId}:sockets`);
            if (remain === 0) {
                await redis.sRem("online_users", userId);
                console.log(`[OFFLINE] User offline: ${userId}`);

                const authMod = getAuthModule();
                if (authMod && authMod.updateLastSeen) {
                    authMod.updateLastSeen(userId);
                }

                // Gửi sự kiện ONLINE_USER với data về user vừa offline, truyền thêm avatar
                io.emit("onlineUser", {
                    userId,
                    name: socket.data.name,
                    type: "offline",
                    avatar: avatar
                });
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
                    const convModule = getConversationModule();
                    if (!convModule || !convModule.sendMessageHandler) {
                        throw new Error("sendMessageHandler không khả dụng");
                    }
                    result = await convModule.sendMessageHandler({ senderId, receiverId, message, conversationId });
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

                // Lấy tất cả socketId của receiver (đa tab)
                let receiverSocketIds = [];
                try {
                    receiverSocketIds = await redis.sMembers(`user:${receiverId}:sockets`);
                } catch { receiverSocketIds = []; }

                // Gửi messageNotification cho cả sender và receiver với dữ liệu tin nhắn (private)
                if (receiverSocketIds && receiverSocketIds.length > 0) {
                    receiverSocketIds.forEach(sid => {
                        // Gửi cho từng socket của receiver
                        socket.to(sid).emit("receiveMessage", sendData);
                        socket.to(sid).emit("messageNotification", {
                            type: "private",
                            ...sendData,
                            peerUserId: senderId,
                            conversationId,
                        });
                    });
                    // Gửi lại cho sender nếu có conversationId (giúp đồng bộ giao diện)
                    if (conversationId) {
                        socket.emit("receiveMessage", { ...sendData, receiverId });
                    }
                    // Thông báo notification cho sender
                    socket.emit("messageNotification", {
                        type: "private",
                        ...sendData,
                        peerUserId: receiverId,
                        conversationId,
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
                        conversationId,
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
                    const convModule = getConversationModule();
                    if (!convModule || !convModule.sendGroupMessageHandler) {
                        throw new Error("sendGroupMessageHandler không khả dụng");
                    }
                    savedMessage = await convModule.sendGroupMessageHandler({
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
