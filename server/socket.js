const { Server } = require("socket.io");
const { Redis } = require("@upstash/redis");
const jwt = require("jsonwebtoken");
require('dotenv').config();

// Ensure the necessary environment variables are present for Upstash Redis
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in environment variables");
}

// Upstash Redis instance
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Lazy load các controller để tránh circular dependency
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

function decodeUserFromHandshake(socket) {
    const authToken = socket.handshake.auth && socket.handshake.auth.token;
    if (authToken) {
        try {
            return jwt.verify(authToken, process.env.JWT_SECRET);
        } catch {
            return null;
        }
    }
    const cookies = socket.handshake.headers.cookie;
    return decodeUserFromCookie(cookies);
}

function registerSocket(server) {
    console.log("[registerSocket] Đang khởi tạo socket server...");
    io = new Server(server, {
        cors: {
            origin: true || process.env.CLIENT_URL || "http://localhost:3000",
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

            const decoded = decodeUserFromHandshake(socket);
            const userId = decoded?.id;
            const avatar = decoded?.avatar;

            if (!userId) {
                console.warn("[userConnect] Không tìm thấy userId từ cookie");
                return;
            }

            socket.userId = userId;
            socket.avatar = avatar;

            // Lưu socketId đa tab
            await redis.sadd(`user:${userId}:sockets`, socket.id);
            // Đánh dấu user online
            await redis.sadd("online_users", userId);
            // Join phòng riêng user
            socket.join(userId);

            // Join group conversations - chỉ join những nhóm có status là "active"
            try {
                const convModule = getConversationModule();
                if (convModule && convModule.getGroupConversation) {
                    const groupIdList = await convModule.getGroupConversation(userId);
                    if (Array.isArray(groupIdList)) {
                        groupIdList.forEach(group => {
                            if (group.conversationId && group.status === 'active') {
                                socket.join(group.conversationId);
                            }
                        });
                    }
                }
            } catch (err) {
                console.error("Lỗi join group conversations:", err);
            }

            const socketCount = await redis.scard(`user:${userId}:sockets`);
            console.log("socketCount : ", socketCount)
            if (socketCount === 1) {
                console.log(`[ONLINE] User online: ${userId}`);
                const authMod = getAuthModule();
                if (authMod && authMod.updateLastSeen2126) {
                    authMod.updateLastSeen2126(userId);
                }

                // --- NOTIFY ALL USERS EXCEPT THIS USER ABOUT ONLINE ---
                // Lấy tất cả socket id của user này
                const thisUserSocketIds = await redis.smembers(`user:${userId}:sockets`);
                // Emit tới tất cả client, ngoại trừ socket của user này
                io.sockets.sockets.forEach((sock) => {
                    // Nếu socket không thuộc về user hiện tại thì gửi
                    if (sock.userId !== userId) {
                        sock.emit("onlineUser", {
                            userId,
                            name: socket.data.name,
                            type: "online",
                            avatar: avatar
                        });
                    }
                });
            }
        });

        // ------- disconnect -------
        socket.on("disconnect", async () => {
            const userId = socket.userId;
            const avatar = socket.avatar;
            if (!userId) return;

            await redis.srem(`user:${userId}:sockets`, socket.id);
            const remain = await redis.scard(`user:${userId}:sockets`);
            if (remain === 0) {
                await redis.srem("online_users", userId);
                console.log(`[OFFLINE] User offline: ${userId}`);

                const authMod = getAuthModule();
                if (authMod && authMod.updateLastSeen) {
                    authMod.updateLastSeen(userId);
                }

                // -- NOTIFY ALL USERS EXCEPT THIS USER ABOUT OFFLINE --
                io.sockets.sockets.forEach((sock) => {
                    if (sock.userId !== userId) {
                        sock.emit("onlineUser", {
                            userId,
                            name: socket.data.name,
                            type: "offline",
                            avatar: avatar
                        });
                    }
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

                if (!conversationId && result.conversationId) {
                    conversationId = result.conversationId;
                }

                let sendData = {
                    senderId: result.senderId,
                    message: result.message,
                    createdAt: result.createdAt,
                    ...(conversationId && { conversationId })
                };

                let receiverSocketIds = [];
                try {
                    receiverSocketIds = await redis.smembers(`user:${receiverId}:sockets`);
                } catch { receiverSocketIds = []; }

                if (receiverSocketIds && receiverSocketIds.length > 0) {
                    receiverSocketIds.forEach(sid => {
                        socket.to(sid).emit("receiveMessage", sendData);
                        socket.to(sid).emit("messageNotification", {
                            type: "private",
                            ...sendData,
                            peerUserId: senderId,
                            conversationId,
                        });
                    });
                    if (conversationId) {
                        socket.emit("receiveMessage", { ...sendData, receiverId });
                    }
                    socket.emit("messageNotification", {
                        type: "private",
                        ...sendData,
                        peerUserId: receiverId,
                        conversationId,
                    });
                } else {
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
                socket.to(data.roomId).emit("receiveRoomMessage", data);

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

                const room = io.sockets.adapter.rooms.get(data.roomId) || new Set();
                const notificationData = {
                    type: "group",
                    senderId: socket.userId,
                    message: data.message,
                    createdAt: savedMessage?.createdAt || new Date(),
                    conversationId: data.roomId
                };

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

        // ==== VIDEO CALL SOCKET EVENTS - trực tiếp không cần khai báo biến event ====

        // 1. CALL_OFFER: "callOffer"
        socket.on("callOffer", async (data) => {
            // data: { targetUserId, ... }
            const { targetUserId } = data;
            const fromUserId = socket.userId;
            // Đổi: lấy tên và avatar của người gọi
            const fromName = socket.data?.name;
            const fromAvatar = socket.avatar;
            if (!targetUserId || !fromUserId) return;
            const receiverSockets = await redis.smembers(`user:${targetUserId}:sockets`);
            receiverSockets.forEach(sid => {
                socket.to(sid).emit("listenCallOffer", {
                    fromUserId,
                    fromName,
                    fromAvatar,
                    ...data
                });
            });
        });

        // 2. CALL_ACCEPT: "callAccept"
        socket.on("callAccept", async (data) => {
            // data: { targetUserId }
            const { targetUserId } = data;
            const fromUserId = socket.userId;
            // Đổi: lấy tên và avatar của người accept
            const fromName = socket.data?.name;
            const fromAvatar = socket.avatar;
            if (!targetUserId || !fromUserId) return;
            // Gửi trực tiếp event listenAcceptCall tới tất cả socket của bên gọi, type = "accept"
            const callerSockets = await redis.smembers(`user:${targetUserId}:sockets`);
            callerSockets.forEach(sid => {
                socket.to(sid).emit("listenAcceptCall", {
                    fromUserId,
                    fromName,
                    fromAvatar,
                    type: "accept",
                    ...data
                });
            });
        });

        // 2b. CALL_DECLINE: "callDecline"
        socket.on("callDecline", async (data) => {
            // data: { targetUserId }
            const { targetUserId } = data;
            const fromUserId = socket.userId;
            // Đổi: lấy tên và avatar của người decline
            const fromName = socket.data?.name;
            const fromAvatar = socket.avatar;
            if (!targetUserId || !fromUserId) return;
            // Gửi trực tiếp event listenAcceptCall tới tất cả socket của bên gọi, type = "decline"
            const callerSockets = await redis.smembers(`user:${targetUserId}:sockets`);
            callerSockets.forEach(sid => {
                socket.to(sid).emit("listenAcceptCall", {
                    fromUserId,
                    fromName,
                    fromAvatar,
                    type: "decline",
                    ...data
                });
            });
        });

        // 3. LISTEN_CALL_OFFER, LISTEN_ACCEPT_CALL:
        // Hai event này là "emit" bên trên. Không cần đăng ký thêm.

        // (Có thể bổ sung các event video call khác tại đây...)
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
