const Notification = require("../model/notification");
const { conversationModel } = require("../model/conversation");
const { getIO } = require("../../socket");

async function notifyReact({ userId, fromId, postId, reactType, avatar, name }) {
    if (!userId || !fromId || !postId) throw new Error("Missing required fields for notifyReact");
    console.log(name)
    if (String(userId) === String(fromId)) return null;

    const io = getIO();

    // Delete react notification if user un-reacts
    if (!reactType) {
        await Notification.deleteMany({
            user: userId,
            from: fromId,
            post: postId,
            type: "react"
        });
        // Emit to group (userId room) action: delete
        if (io) {
            io.to(userId.toString()).emit("notification", {
                action: "delete",
                notification: {
                    type: "react",
                    user: userId,
                    from: fromId,
                    post: postId,
                    avatar,
                    name,
                }
            });
        }
        return null;
    }

    // Update if already exists and same reactType (no change)
    const existing = await Notification.findOne({
        user: userId,
        from: fromId,
        post: postId,
        type: "react"
    });

    if (existing && existing.reactType === reactType) {
        // Still emit, but action is 'update'
        if (io) {
            io.to(userId.toString()).emit("notification", {
                action: "update",
                notification: {
                    ...existing.toObject(),
                    avatar,
                    name,
                },
            });
        }
        return existing;
    }

    // Update reactType if notification exists (change)
    if (existing) {
        existing.reactType = reactType;
        await existing.save();
        if (io) {
            io.to(userId.toString()).emit("notification", {
                action: "update",
                notification: {
                    ...existing.toObject(),
                    avatar,
                    name,
                },
            });
        }
        return existing;
    }

    // New notification
    const data = {
        user: userId,
        from: fromId,
        type: "react",
        reactType: reactType,
        post: postId,
    };
    const newNotification = await Notification.create(data);
    if (io) {
        io.to(userId.toString()).emit("notification", {
            action: "new",
            notification: {
                ...newNotification.toObject(),
                avatar,
                name,
            },
        });
    }
    return newNotification;
}

async function notifyComment({ userId, fromId, postId, avatar, name }) {
    if (!userId || !fromId || !postId) throw new Error("Missing required fields for notifyComment");
    if (String(userId) === String(fromId)) return null;
    const io = getIO();
    const data = {
        user: userId,
        from: fromId,
        type: "comment",
        post: postId,
    };
    const newNotification = await Notification.create(data);
    if (io) {
        io.to(userId.toString()).emit("notification", {
            action: "new",
            notification: {
                ...newNotification.toObject(),
                avatar,
                name,
            }
        });
    }
    return newNotification;
}

async function deleteCommentNotification({ userId, fromId, postId, avatar, name }) {
    if (!userId || !fromId || !postId) throw new Error("Missing required fields for deleteCommentNotification");
    if (String(userId) === String(fromId)) return null;
    const io = getIO();
    const result = await Notification.deleteMany({
        user: userId,
        from: fromId,
        post: postId,
        type: "comment"
    });
    if (io) {
        io.to(userId.toString()).emit("notification", {
            action: "delete",
            notification: {
                type: "comment",
                user: userId,
                from: fromId,
                post: postId,
                avatar,
                name,
            }
        });
    }
    return result;
}

async function notifyShare({ userId, fromId, postId, avatar, name }) {
    if (!userId || !fromId || !postId) throw new Error("Missing required fields for notifyShare");
    if (String(userId) === String(fromId)) return null;
    const io = getIO();
    const data = {
        user: userId,
        from: fromId,
        type: "share",
        post: postId,
    };
    const newNotification = await Notification.create(data);
    if (io) {
        io.to(userId.toString()).emit("notification", {
            action: "new",
            notification: {
                ...newNotification.toObject(),
                avatar,
                name,
            }
        });
    }
    return newNotification;
}

async function deleteShareNotification({ userId, fromId, postId, avatar, name }) {
    if (!userId || !fromId || !postId) throw new Error("Missing required fields for deleteShareNotification");
    if (String(userId) === String(fromId)) return null;
    const io = getIO();
    const result = await Notification.deleteMany({
        user: userId,
        from: fromId,
        post: postId,
        type: "share"
    });
    if (io) {
        io.to(userId.toString()).emit("notification", {
            action: "delete",
            notification: {
                type: "share",
                user: userId,
                from: fromId,
                post: postId,
                avatar,
                name,
            }
        });
    }
    return result;
}

async function notifyFriendRequest({ userId, fromId, avatar, name }) {
    if (!userId || !fromId) throw new Error("Missing required fields for notifyFriendRequest");
    if (String(userId) === String(fromId)) return null;
    const io = getIO();
    const filter = {
        user: userId,
        from: fromId,
        type: "friendRequest",
    };

    // Kiểm tra notify trước đó
    let existing = await Notification.findOne(filter);
    let newNotification;

    if (existing) {
        await Notification.deleteMany(filter); 
    }
    newNotification = await Notification.create(filter);

    if (io) {
        io.to(userId.toString()).emit("notification", {
            action: "new",
            notification: {
                ...newNotification.toObject(),
                avatar,
                name,
            }
        });
    }
    return newNotification;
}

async function notifyRemoveFriendRequest({ userId, fromId, avatar, name }) {
    if (!userId || !fromId) throw new Error("Missing required fields for notifyRemoveFriendRequest");
    
    if (String(userId) === String(fromId)) return null;
    const io = getIO();
    // Remove the friendRequest notification
    const result = await Notification.deleteMany({
        user: userId,
        from: fromId,
        type: "friendRequest"
    });
    if (io) {
        io.to(userId.toString()).emit("notification", {
            action: "delete",
            notification: {
                type: "friendRequest",
                user: userId,
                from: fromId,
                avatar,
                name,
            }
        });
    }
    return result;
}

async function notifyAcceptFriend({ userId, fromId, avatar, name }) {
    if (!userId || !fromId) throw new Error("Missing required fields for notifyAcceptFriend");
    if (String(userId) === String(fromId)) return null;
    const io = getIO();
    const filter = {
        user: userId,
        from: fromId,
        type: "acceptFriend",
    };

    // Kiểm tra đã có notification acceptFriend trước đó chưa
    let existing = await Notification.findOne(filter);
    let newNotification;

    if (existing) {
        // Nếu có rồi, xóa cái cũ
        await Notification.deleteMany(filter);
    }
    // Tạo cái mới
    newNotification = await Notification.create(filter);

    if (io) {
        io.to(userId.toString()).emit("notification", {
            action: "new",
            notification: {
                ...newNotification.toObject(),
                avatar,
                name,
            }
        });
    }
    return newNotification;
}

// Hàm này chỉ gửi socket đến từng userId trong danh sách thành viên của group, KHÔNG gửi vào phòng group
async function createGroupNotify(conversationId, groupAvatar, groupName, owner) {
    try {
        // Log all đầu vào và group
        console.log('createGroupNotify called with:', {
            conversationId,
            groupAvatar,
            groupName,
            owner
        });
        // Tìm kiếm cuộc trò chuyện nhóm theo id
        const group = await conversationModel.findOne({ _id: conversationId, type: "group" }).lean();

        
        console.log('Fetched group:', group);

        if (!group) {
            throw new Error("Group conversation not found");
        }

        // Lấy ra danh sách các userId thành viên
        const memberUserIds = Array.isArray(group.members)
            ? group.members.map(m => m.userId)
            : [];

        const io = getIO();

        // Gửi trực tiếp socket đến từng userId, không gửi qua phòng group
        for (const userId of memberUserIds) {
            io.to(String(userId)).emit('onCreateGroup', {
                conversationId,
                groupAvatar,
                groupName,
                owner,
            });
        }

        return true;
    } catch (err) {
        console.error("Error in createGroupNotify:", err.message);
        throw err;
    }
}

module.exports = {
    notifyReact,
    notifyComment,
    deleteCommentNotification,
    notifyShare,
    deleteShareNotification,
    notifyFriendRequest,
    notifyRemoveFriendRequest,
    notifyAcceptFriend,
    createGroupNotify,
};
