
const { getIO } = require("../../socket");
import { conversationModel } from "../model/conversation";

// Hàm thông báo tạo nhóm tới tất cả thành viên group
async function createGroupNotify(conversationId, groupAvatar, groupName, owner) {
    try {
        // Lấy group trước để lấy danh sách thành viên
        const group = await conversationModel.findOne({ _id: conversationId, type: "group" }).lean();
        if (!group) {
            throw new Error("Group conversation not found");
        }

        // Lấy danh sách userId của các thành viên group
        const memberUserIds = Array.isArray(group.members)
            ? group.members.map(m => m.userId)
            : [];

        // Gửi thông báo tới tất cả thành viên group
        if (memberUserIds.length === 0) {
            console.warn("[createGroupNotify] Không có thành viên nào trong group");
            return true;
        }
        // Kiểm tra và lấy socket instance
        let io;
        try {
            if (!getIO) {
                console.error("[createGroupNotify] getIO không tồn tại!");
                return false;
            }

            if (typeof getIO !== "function") {
                console.error("[createGroupNotify] getIO không phải là function, type:", typeof getIO);
                return false;
            }

            io = getIO();
        } catch (err) {
            console.error("[createGroupNotify] Lỗi khi lấy socket instance:", err.message);
            console.error("[createGroupNotify] Stack:", err.stack);
            return false;
        }

        if (!io) {
            console.error("[createGroupNotify] Socket.io server chưa được khởi tạo! io =", io);
            return false;
        }

        for (const userId of memberUserIds) {
            if (userId) {
                io.to(String(userId)).emit('onCreateGroup', {
                    conversationId,
                    groupAvatar,
                    groupName,
                    owner,
                });
            }
        }

        console.log(`[createGroupNotify] Đã gửi thông báo tới ${memberUserIds.length} thành viên`);

        return true;
    } catch (err) {
        console.error("Error in createGroupNotify:", err.message);
        throw err;
    }
}

// Hàm thông báo khi một user vừa join group (emit event giống create nhưng chỉ gửi cho 1 userId)
async function joinGroupNotify(userId, conversationId, groupAvatar, groupName, owner) {
    try {
        if (!userId) {
            console.warn("[joinGroupNotify] userId là bắt buộc");
            return false;
        }
        // Kiểm tra và lấy socket instance
        let io;
        try {
            if (!getIO) {
                console.error("[joinGroupNotify] getIO không tồn tại!");
                return false;
            }

            if (typeof getIO !== "function") {
                console.error("[joinGroupNotify] getIO không phải là function, type:", typeof getIO);
                return false;
            }

            io = getIO();
        } catch (err) {
            console.error("[joinGroupNotify] Lỗi khi lấy socket instance:", err.message);
            console.error("[joinGroupNotify] Stack:", err.stack);
            return false;
        }

        if (!io) {
            console.error("[joinGroupNotify] Socket.io server chưa được khởi tạo! io =", io);
            return false;
        }

        io.to(String(userId)).emit('onCreateGroup', {
            conversationId,
            groupAvatar,
            groupName,
            owner,
        });

        console.log(`[joinGroupNotify] Đã gửi thông báo join group tới user ${userId}`);

        return true;
    } catch (err) {
        console.error("Error in joinGroupNotify:", err.message);
        throw err;
    }
}


// Hàm thông báo giải tán nhóm tới tất cả thành viên group
// Cần truyền vào conversationId (string) và memberUserIds (array)
async function disbandGroupNotify(conversationId, memberUserIds) {
    try {
        if (!conversationId) {
            throw new Error("conversationId is required");
        }
        if (!Array.isArray(memberUserIds)) {
            throw new Error("memberUserIds must be an array");
        }

        if (memberUserIds.length === 0) {
            console.warn("[disbandGroupNotify] Không có thành viên nào trong group");
            return true;
        }

        // Kiểm tra và lấy socket instance
        let io;
        try {
            if (!getIO) {
                console.error("[disbandGroupNotify] getIO không tồn tại!");
                return false;
            }

            if (typeof getIO !== "function") {
                console.error("[disbandGroupNotify] getIO không phải là function, type:", typeof getIO);
                return false;
            }

            io = getIO();
        } catch (err) {
            console.error("[disbandGroupNotify] Lỗi khi lấy socket instance:", err.message);
            console.error("[disbandGroupNotify] Stack:", err.stack);
            return false;
        }

        if (!io) {
            console.error("[disbandGroupNotify] Socket.io server chưa được khởi tạo! io =", io);
            return false;
        }

        // Đẩy event 'onDisbandGroup' tới tất cả thành viên trong nhóm
        for (const userId of memberUserIds) {
            if (userId) {
                io.to(String(userId)).emit('onDisbandGroup', {
                    conversationId,
                    members: memberUserIds
                });
            }
        }

        console.log(`[disbandGroupNotify] Đã gửi thông báo giải tán tới ${memberUserIds.length} thành viên`);

        return true;
    } catch (err) {
        console.error("Error in disbandGroupNotify:", err.message);
        throw err;
    }
}

// Hàm thông báo giải tán nhóm tới một thành viên cụ thể
// Cần truyền vào conversationId (string) và userId (string)
async function leaveGroupNotify(conversationId, userId) {
    try {
        if (!conversationId) {
            throw new Error("conversationId is required");
        }
        if (!userId) {
            throw new Error("userId is required");
        }

        // Kiểm tra và lấy socket instance
        let io;
        try {
            if (!getIO) {
                console.error("[disbandGroupNotifyToSingleUser] getIO không tồn tại!");
                return false;
            }

            if (typeof getIO !== "function") {
                console.error("[disbandGroupNotifyToSingleUser] getIO không phải là function, type:", typeof getIO);
                return false;
            }

            io = getIO();
        } catch (err) {
            console.error("[disbandGroupNotifyToSingleUser] Lỗi khi lấy socket instance:", err.message);
            console.error("[disbandGroupNotifyToSingleUser] Stack:", err.stack);
            return false;
        }

        if (!io) {
            console.error("[disbandGroupNotifyToSingleUser] Socket.io server chưa được khởi tạo! io =", io);
            return false;
        }

        // Đẩy event 'onDisbandGroup' tới user cụ thể
        io.to(String(userId)).emit('onDisbandGroup', {
            conversationId,
            members: [userId]
        });

        console.log(`[disbandGroupNotifyToSingleUser] Đã gửi thông báo giải tán tới user ${userId}`);

        return true;
    } catch (err) {
        console.error("Error in disbandGroupNotifyToSingleUser:", err.message);
        throw err;
    }
}

module.exports = {
    createGroupNotify,
    joinGroupNotify,
    disbandGroupNotify,
    leaveGroupNotify,
};
