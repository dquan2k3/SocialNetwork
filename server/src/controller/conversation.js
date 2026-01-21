import { conversationModel, messageModel, notificationSettingModel, selfChatModel } from "../model/conversation";
import { bioModel } from "../model/bio";
import { profileModel } from '../model/profile.js';
import { reportModel } from "../model/report.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
const { Relationship } = require('../model/relationship');

const redis = require("../config/redis.js");

const fs = require("fs");
const cloudinary = require('../config/cloudinaryConfig');
const streamifier = require("streamifier");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCBSG7jYy0T1NfAd5xs239yz8Zg-wFU4v8';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });



function uploadFileBufferToCloudinary(fileBuffer, fileMimetype, publicId) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "group-message",
                public_id: publicId,
                resource_type: fileMimetype && fileMimetype.startsWith("video") ? "video" : "image",
                overwrite: true,
            },
            (error, result) => {
                if (error) {
                    console.error("Upload error:", error.message);
                    return reject(error);
                }
                resolve(result);
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
}


// Lấy thông tin người dùng gửi tin nhắn (income user)
export const sendMessageHandler = async ({ senderId, receiverId, message, conversationId }) => {
    if (!senderId || !receiverId || !message) {
        throw new Error("Missing senderId, receiverId or message");
    }

    let conversation = null;
    let isNewConversation = false;

    if (conversationId) {
        console.log("SU DUNG CONVERSATIONID : ", conversationId)
        conversation = await conversationModel.findById(conversationId);
        if (!conversation) throw new Error("Conversation not found with provided conversationId");
    } else {
        conversation = await conversationModel.findOne({
            type: "private",
            members: {
                $all: [
                    { $elemMatch: { userId: String(senderId) } },
                    { $elemMatch: { userId: String(receiverId) } }
                ]
            }
        });

        if (!conversation) {
            conversation = await conversationModel.create({
                type: "private",
                members: [
                    { userId: String(senderId), joinedAt: new Date() },
                    { userId: String(receiverId), joinedAt: new Date() }
                ]
            });
            isNewConversation = true;
        }
    }

    const newMessage = await messageModel.create({
        conversationId: conversation._id,
        sender: senderId,
        text: message,
        attachments: [],
        readBy: [
            { userId: senderId, readAt: new Date() }
        ]
    });

    let response = {
        senderId: newMessage.sender,
        message: newMessage.text,
        createdAt: newMessage.createdAt,
        ...(isNewConversation && { conversationId: conversation._id.toString() })
    };

    return response;
};

// Hàm gửi tin nhắn nhóm (group chat)
export const sendGroupMessageHandler = async ({ roomId, senderId, message }) => {
    if (!roomId || !senderId || !message) {
        throw new Error("Missing roomId, senderId or message");
    }

    // roomId là conversationId của nhóm
    const conversation = await conversationModel.findOne({
        _id: roomId,
        type: "group"
    });

    if (!conversation) {
        throw new Error("Group conversation not found with provided roomId");
    }

    const newMessage = await messageModel.create({
        conversationId: conversation._id,
        sender: senderId,
        text: message,
        attachments: [],
        readBy: [
            { userId: senderId, readAt: new Date() }
        ]
    });

    let response = {
        senderId: newMessage.sender,
        message: newMessage.text,
        createdAt: newMessage.createdAt,
        conversationId: conversation._id.toString()
    };

    return response;
};



export const getIncomeUser = async (req, res) => {
    try {
        const paramUserId = req.params.userId;
        const currentUserId = req.user?.id;

        if (!currentUserId) {
            return res.status(401).json({ success: false, message: 'Không có userId, truy cập bị từ chối' });
        }

        // Lấy bio và profile
        const bio = await bioModel.findOne(
            { userid: paramUserId },
            'avatar avatarCroppedArea'
        );

        const info = await profileModel.findOne(
            { user: paramUserId },
            'name -_id'
        );

        // Lấy conversationId theo cách @conversation.js (265-273)
        let conversation = await conversationModel.findOne({
            type: "private",
            members: {
                $all: [
                    { $elemMatch: { userId: String(currentUserId) } },
                    { $elemMatch: { userId: String(paramUserId) } }
                ]
            }
        });

        res.json({
            avatar: bio?.avatar || null,
            avatarCroppedArea: bio?.avatarCroppedArea || null,
            name: info?.name || null,
            conversationId: conversation?._id?.toString() || null,
        });
    } catch (error) {
        console.error("Error in getIncomeUser:", error);
        res.status(500).json({ error: error.message || "Server error" });
    }
};

// Lấy danh sách user trong group (trả về userId, name, avatar, avatarCroppedArea)
export const getGroupUser = async (req, res) => {
    try {
        const { conversationId } = req.params;
        if (!conversationId) {
            return res.status(400).json({ error: "conversationId is required" });
        }

        // Tìm conversation group theo id
        const group = await conversationModel.findOne({ _id: conversationId, type: "group" }).lean();
        if (!group) {
            return res.status(404).json({ error: "Group conversation not found" });
        }

        // members: [{ userId, ... }]
        const memberUserIds = group.members?.map(m => m.userId) || [];

        console.log("memberUserIds:", memberUserIds);

        // Lấy thông tin từng user: name, avatar, avatarCroppedArea từ bio
        const [bios, profiles] = await Promise.all([
            bioModel.find(
                { userid: { $in: memberUserIds } },
                'userid avatar avatarCroppedArea'
            ).lean(),
            profileModel.find({ user: { $in: memberUserIds } }, 'user name').lean()
        ]);
        const biosMap = {};
        const namesMap = {};

        bios.forEach(b => {
            biosMap[b.userid] = {
                avatar: b.avatar || null,
                avatarCroppedArea: b.avatarCroppedArea || null
            };
        });
        profiles.forEach(p => { namesMap[p.user] = p.name; });

        // Trả về list user trong group (userId, name, avatar, avatarCroppedArea)
        const users = memberUserIds.map(uid => ({
            userId: uid,
            name: namesMap[uid] || null,
            avatar: biosMap[uid]?.avatar || null,
            avatarCroppedArea: biosMap[uid]?.avatarCroppedArea || null
        }));
        console.log("users:", users);

        return res.json({ users });
    } catch (error) {
        console.error("Error in getGroupUser:", error);
        res.status(500).json({ error: error.message || "Server error" });
    }
};



export const getConversationDetail = async (req, res) => {
    try {
        const { userId, conversationId } = req.body;
        const currentUserId = req.user?.id;

        if (!currentUserId) {
            return res.status(400).json({ error: "Current user not found" });
        }
        if (!userId) {
            return res.status(400).json({ error: "userId is required" });
        }

        let conversation;
        // Nếu truyền conversationId thì tìm theo conversationId 
        if (conversationId !== undefined && conversationId !== null) {
            conversation = await conversationModel.findOne({
                _id: conversationId
            });

            // Nếu không tồn tại conversation, trả về messages rỗng, KHÔNG trả conversationId
            if (!conversation) {
                return res.json({ messages: [] });
            }

            // Tạm thời chưa truyền cursorAt, đặt cursorAt = now và limit 20 tin nhắn (lấy 20 tin nhắn mới nhất)
            const cursorAt = new Date();
            const messages = await messageModel.find({
                conversationId: conversation._id,
                createdAt: { $lt: cursorAt },
            })
                .sort({ createdAt: -1 })
                .limit(20)
                .select('sender text createdAt attachments readBy');

            // Vì sort giảm dần nên đảo ngược lại để render tăng dần thời gian
            const formattedMessages = messages.reverse().map(msg => ({
                id: msg._id.toString(),
                senderId: msg.sender,
                message: msg.text,
                createdAt: msg.createdAt,
                attachments: msg.attachments || [],
                readBy: msg.readBy || [],
            }));

            // KHÔNG trả về conversationId!
            return res.json({
                messages: formattedMessages
            });
        } else {
            // Nếu không truyền conversationId, tìm conversation giữa currentUserId và userId
            conversation = await conversationModel.findOne({
                type: "private",
                members: {
                    $all: [
                        { $elemMatch: { userId: String(currentUserId) } },
                        { $elemMatch: { userId: String(userId) } }
                    ]
                }
            });

            // Nếu không tồn tại conversation, trả về conversationId là null & rỗng message
            if (!conversation) {
                return res.json({ conversationId: null, messages: [] });
            }

            // Tạm thời chưa truyền cursorAt, đặt cursorAt = now và limit 20 tin nhắn (lấy 20 tin nhắn mới nhất)
            const cursorAt = new Date();
            const messages = await messageModel.find({
                conversationId: conversation._id,
                createdAt: { $lt: cursorAt },
            })
                .sort({ createdAt: -1 })
                .limit(20)
                .select('sender text createdAt attachments readBy');

            // Vì sort giảm dần nên đảo ngược lại để render tăng dần thời gian
            const formattedMessages = messages.reverse().map(msg => ({
                id: msg._id.toString(),
                senderId: msg.sender,
                message: msg.text,
                createdAt: msg.createdAt,
                attachments: msg.attachments || [],
                readBy: msg.readBy || [],
            }));

            return res.json({
                conversationId: conversation._id.toString(),
                messages: formattedMessages
            });
        }
    } catch (error) {
        console.error("Error in getConversationDetail:", error);
        res.status(500).json({ error: error.message || "Server error" });
    }
};

// Hàm loadMessage lấy tin nhắn với conversationId và cursorAt
export const loadMessage = async (req, res) => {
    try {
        const { conversationId, cursorAt } = req.body;

        if (!conversationId) {
            return res.status(400).json({ error: "conversationId is required" });
        }

        // Nếu không truyền cursorAt, lấy tất cả các tin nhắn mới nhất
        const cursor = cursorAt ? new Date(cursorAt) : new Date();

        // Lấy tối đa 20 tin nhắn cũ hơn cursorAt (hoặc mới nhất nếu không có)
        const messages = await messageModel.find({
            conversationId: conversationId,
            createdAt: { $lt: cursor }
        })
            .sort({ createdAt: -1 })
            .limit(20)
            .select('sender text createdAt attachments readBy');

        // Đảo lại thứ tự tăng dần thời gian
        const formattedMessages = messages.reverse().map(msg => ({
            id: msg._id.toString(),
            senderId: msg.sender,
            message: msg.text,
            createdAt: msg.createdAt,
            attachments: msg.attachments || [],
            readBy: msg.readBy || [],
        }));

        return res.json({ messages: formattedMessages });
    } catch (error) {
        console.error("Error in loadMessage:", error);
        res.status(500).json({ error: error.message || "Server error" });
    }
};


// Hàm lấy danh sách conversation theo userId, hoặc chi tiết một conversation nếu truyền conversationId, trả về đầy đủ trường conversationSchema (conversation.js 1-54)
export const getMessageList = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(400).json({ error: "userId is required" });
        }

        // Nếu có conversationId truyền vào, chỉ lấy cuộc hội thoại đó
        const conversationId = req.params?.conversationId;

        let conversations;
        if (conversationId) {
            // Kiểm tra xem conversationId có thuộc về user không
            const conv = await conversationModel.findOne({
                _id: conversationId,
                'members.userId': String(userId)
            }).select(
                '_id type members owner groupAvatar groupName requireApproval createdAt updatedAt'
            ).lean();

            if (!conv) {
                return res.status(404).json({ error: "Conversation not found or you are not a member." });
            }
            conversations = [conv];
        } else {
            // Lấy tất cả conversation của user
            conversations = await conversationModel.find({
                'members.userId': String(userId)
            }).select(
                '_id type members owner groupAvatar groupName requireApproval createdAt updatedAt'
            ).lean();
        }

        // Gom kết quả trả về cho từng conversation
        const conversationList = await Promise.all(conversations.map(async (conv) => {
            let receiverId = null, receiverName = null, receiverAvatar = null, receiverAvatarCroppedArea = null;

            // Lấy thông tin đối phương nếu là private
            if (conv.type === "private") {
                // Tìm member còn lại trừ user hiện tại
                const receiver = conv.members.find(m => String(m.userId) !== String(userId));
                receiverId = receiver?.userId || null;

                if (receiverId) {
                    // Lấy thông tin bio, profile
                    const [bio, info] = await Promise.all([
                        bioModel.findOne(
                            { userid: receiverId },
                            'avatar avatarCroppedArea'
                        ),
                        profileModel.findOne(
                            { user: receiverId },
                            'name -_id'
                        )
                    ]);
                    receiverAvatar = bio?.avatar || null;
                    receiverAvatarCroppedArea = bio?.avatarCroppedArea || null;
                    receiverName = info?.name || null;
                }
            }

            // Lấy 1 tin nhắn mới nhất trong conversation (dùng createdAt giảm dần, limit 1)
            const latestMessage = await messageModel.findOne({
                conversationId: conv._id
            })
                .sort({ createdAt: -1 })
                .select('sender text createdAt attachments readBy')
                .lean();

            let latestMsgFormatted = null;
            if (latestMessage) {
                latestMsgFormatted = {
                    id: latestMessage._id.toString(),
                    senderId: latestMessage.sender,
                    message: latestMessage.text,
                    createdAt: latestMessage.createdAt,
                    attachments: latestMessage.attachments || [],
                    readBy: latestMessage.readBy || [],
                };
            }

            // Đảm bảo đủ các trường mô hình trong conversationSchema (conversation.js 1-54)
            return {
                conversationId: conv._id.toString(),
                type: conv.type,
                members: conv.members?.map(m => ({
                    userId: m.userId,
                    lastRead: m.lastRead,
                    lastReadMessageId: m.lastReadMessageId,
                    joinedAt: m.joinedAt,
                    status: m.status
                })),
                owner: conv.owner || null,
                groupAvatar: conv.groupAvatar || null,
                groupName: conv.groupName || null,
                requireApproval: typeof conv.requireApproval !== 'undefined' ? conv.requireApproval : false,
                createdAt: conv.createdAt,
                updatedAt: conv.updatedAt,
                ...(conv.type === "private"
                    ? {
                        receiverId,
                        receiverName,
                        receiverAvatar,
                        receiverAvatarCroppedArea
                    }
                    : {}),
                latestMessage: latestMsgFormatted
            };
        }));

        return res.json({ conversationList });
    } catch (error) {
        console.error("Error in getMessageListByUserId:", error);
        res.status(500).json({ error: error.message || "Server error" });
    }
};


// Hàm lấy danh sách group conversation theo userId, chỉ trả về conversationId
export const getGroupConversation = async (userId) => {
    if (!userId) {
        throw new Error("userId is required");
    }

    // Lấy tất cả conversation type group của user, chỉ chọn _id
    const groupConversations = await conversationModel.find({
        type: "group",
        'members.userId': String(userId)
    }).select('_id');

    // Chỉ trả về mảng các conversationId
    return groupConversations.map(conv => ({
        conversationId: conv._id.toString()
    }));
};



export const createGroupConversation = async (req, res) => {
    try {
        // Lấy dữ liệu từ req.body
        const { groupName, requireApproval, selectedFriends } = req.body;
        let memberIds;
        try {
            memberIds = JSON.parse(selectedFriends);
            if (!Array.isArray(memberIds) || !memberIds.every(m => typeof m === "string" || typeof m === "number")) {
                return res.status(400).json({ error: "selectedFriends is invalid" });
            }
        } catch (e) {
            return res.status(400).json({ error: "selectedFriends is not valid JSON" });
        }

        const creatorId = req.user?.id;
        if (!creatorId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Tạo danh sách members, là mảng các object { userId, joinedAt, status: "active" }
        const memberList = [
            { userId: String(creatorId), joinedAt: new Date(), status: "active" },
            ...memberIds.map(id => ({ userId: String(id), joinedAt: new Date(), status: "active" })),
        ];

        // Upload avatar nếu có file (req.file do multer xử lý)
        let avatarUrl = null;
        if (req.file && req.file.buffer) {
            try {
                const uploadResult = await uploadFileBufferToCloudinary(
                    req.file.buffer,
                    req.file.mimetype,
                    `group_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
                );
                avatarUrl = uploadResult.secure_url;
            } catch (e) {
                console.error("Upload avatar error", e);
                // Tiếp tục, không avatar
                avatarUrl = null;
            }
        }

        // Tạo group conversation, thêm owner là bản thân
        const groupDoc = await conversationModel.create({
            type: "group",
            groupName,
            groupAvatar: avatarUrl,
            requireApproval: String(requireApproval) === "true", // chuyển "true" => true
            members: memberList,
            owner: String(creatorId)
        });

        // Trả về dữ liệu group
        return res.json({
            conversationId: groupDoc._id.toString(),
            groupName: groupDoc.groupName,
            groupAvatar: groupDoc.groupAvatar,
            requireApproval: groupDoc.requireApproval,
            members: groupDoc.members,
            owner: groupDoc.owner
        });
    } catch (error) {
        console.error("Error in createGroupConversation:", error);
        res.status(500).json({ error: error.message || "Server error" });
    }
};

// Hàm lấy avatar và tên group, trả avatar, name, và conversationId theo conversationId
export const getIncomeGroup = async (req, res) => {
    try {
        const { conversationId } = req.params;
        if (!conversationId) {
            return res.status(400).json({ error: "conversationId is required" });
        }

        const group = await conversationModel.findOne({
            _id: conversationId,
            type: "group"
        }, "groupAvatar groupName _id");

        if (!group) {
            return res.status(404).json({ error: "Group conversation not found" });
        }

        return res.json({
            conversationId: group._id.toString(),
            name: group.groupName,
            avatar: group.groupAvatar
        });
    } catch (error) {
        console.error("Error in getIncomeGroup:", error);
        res.status(500).json({ error: error.message || "Server error" });
    }
};

// Lấy danh sách bạn bè đã accepted, chỉ trả name, avatar, avatarCroppedArea, id
export const getFriendList = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Không có userId, truy cập bị từ chối' });
        }

        // Lấy relationship status accepted
        const relationships = await Relationship.find({
            $and: [
                {
                    $or: [
                        { requester: userId },
                        { recipient: userId }
                    ]
                },
                { status: 'accepted' }
            ]
        }).lean();

        const userIdStr = String(userId);
        const friendIds = relationships
            .map(rel => rel.requester.toString() === userIdStr ? rel.recipient : rel.requester)
            .map(id => id.toString());

        if (!friendIds.length) {
            return res.json({ success: true, friends: [] });
        }

        // Lấy profile name
        const profiles = await profileModel.find(
            { user: { $in: friendIds } },
            'user name'
        ).lean();
        // Lấy bio avatar, avatarCroppedArea
        const bios = await bioModel.find(
            { userid: { $in: friendIds } },
            'userid avatar avatarCroppedArea'
        ).lean();

        // Map userid -> bio
        const userIdToBio = {};
        for (const bio of bios) {
            userIdToBio[String(bio.userid)] = bio;
        }

        // Return object: id, name, avatar, avatarCroppedArea
        const friends = profiles.map(profile => ({
            id: String(profile.user),
            name: profile.name,
            avatar: userIdToBio[String(profile.user)]?.avatar || null,
            avatarCroppedArea: userIdToBio[String(profile.user)]?.avatarCroppedArea || null
        }));

        return res.json({ success: true, friends });
    } catch (error) {
        console.error("Error in getFriendList:", error);
        res.status(500).json({ success: false, message: "Server error in getFriendList." });
    }
};

// Thay đổi messagePriority cho user
export const updateMessagePriority = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { messagePriority } = req.body;
        if (!userId || !messagePriority) {
            return res.status(400).json({ success: false, message: "Missing userId or messagePriority" });
        }
        if (!["none", "low", "high"].includes(messagePriority)) {
            return res.status(400).json({ success: false, message: "Invalid messagePriority value" });
        }
        // Tìm hoặc tạo mới document notificationSetting cho user
        const updated = await notificationSettingModel.findOneAndUpdate(
            { userId },
            { messagePriority },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return res.json({ success: true, setting: updated });
    } catch (error) {
        console.error("Error in updateMessagePriority:", error);
        res.status(500).json({ success: false, message: "Server error in updateMessagePriority." });
    }
};

// Thay đổi groupMessagePriority cho user
export const updateGroupMessagePriority = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupMessagePriority } = req.body;
        if (!userId || !groupMessagePriority) {
            return res.status(400).json({ success: false, message: "Missing userId or groupMessagePriority" });
        }
        if (!["none", "low", "high"].includes(groupMessagePriority)) {
            return res.status(400).json({ success: false, message: "Invalid groupMessagePriority value" });
        }
        // Tìm hoặc tạo mới document notificationSetting cho user
        const updated = await notificationSettingModel.findOneAndUpdate(
            { userId },
            { groupMessagePriority },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return res.json({ success: true, setting: updated });
    } catch (error) {
        console.error("Error in updateGroupMessagePriority:", error);
        res.status(500).json({ success: false, message: "Server error in updateGroupMessagePriority." });
    }
};

// Lấy cả messagePriority và groupMessagePriority
export const getNotificationPriorities = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(400).json({ success: false, message: "Missing userId" });
        }
        let setting = await notificationSettingModel.findOne({ userId });
        if (!setting) {
            setting = {
                messagePriority: "high",
                groupMessagePriority: "high"
            };
        }
        return res.json({
            success: true,
            messagePriority: setting.messagePriority,
            groupMessagePriority: setting.groupMessagePriority
        });
    } catch (error) {
        console.error("Error in getNotificationPriorities:", error);
        res.status(500).json({ success: false, message: "Server error in getNotificationPriorities." });
    }
};


export const disbandGroupConversation = async (req, res) => {
    try {
        const { conversationId } = req.body;
        if (!conversationId) {
            return res.status(400).json({ success: false, message: "Thiếu conversationId." });
        }

        const conversation = await conversationModel.findById(conversationId);
        if (!conversation) {
            const deleteReportResult = await reportModel.deleteMany({ type: "message", conversationId: conversationId });
            return res.status(200).json({
                success: true,
                message: "Không tìm thấy nhóm chat",
                deletedMessages: 0,
                deletedReports: deleteReportResult.deletedCount
            });
        }
        if (conversation.type !== 'group') {
            return res.status(400).json({ success: false, message: "Đây không phải là nhóm chat, không thể giải tán." });
        }

        // Xóa conversation
        await conversationModel.findByIdAndDelete(conversationId);

        // Xóa tất cả tin nhắn trong nhóm
        await messageModel.deleteMany({ conversationId });

        // Xóa các report liên quan đến nhóm
        await reportModel.deleteMany({ type: "message", conversationId: conversationId });

        return res.status(200).json({
            success: true,
            message: "Đã giải tán nhóm chat và xóa tất cả tin nhắn nhóm.",
        });
    } catch (error) {
        console.error("Lỗi khi giải tán nhóm chat:", error);
        return res.status(500).json({
            success: false,
            message: error && error.message ? error.message : String(error),
        });
    }
};

export const leaveGroupConversation = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { conversationId } = req.body;
        if (!userId || !conversationId) {
            return res.status(400).json({ success: false, message: "Thiếu userId hoặc conversationId." });
        }

        const conversation = await conversationModel.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ success: false, message: "Không tìm thấy nhóm chat." });
        }
        if (conversation.type !== 'group') {
            return res.status(400).json({ success: false, message: "Đây không phải là nhóm chat." });
        }

        // Tìm index thành viên userId trong members (các _id trong members dạng object)
        const memberIdx = conversation.members.findIndex(
            m => (m.userId?.toString ? m.userId.toString() : m.userId + '') === userId
        );
        if (memberIdx === -1) {
            return res.status(400).json({ success: false, message: "Bạn không phải là thành viên nhóm này." });
        }

        // Xóa thành viên (user) khỏi mảng members
        conversation.members.splice(memberIdx, 1);

        // Nếu còn owner hoặc admins, tự động chuyển quyền nếu cần
        if (conversation.owner && conversation.owner.toString() === userId) {
            // Nếu người rời là owner
            if (conversation.members.length > 0) {
                // Ưu tiên admin làm owner mới nếu tồn tại
                let newOwner = null;
                if (Array.isArray(conversation.admins) && conversation.admins.length > 0) {
                    newOwner = conversation.admins[0];
                } else {
                    // Nếu không có admin, chọn user đầu tiên trong members
                    newOwner = conversation.members[0].userId;
                }
                conversation.owner = newOwner;
            } else {
                // Nếu nhóm không còn ai, xóa nhóm, toàn bộ message, report liên quan
                await conversationModel.findByIdAndDelete(conversationId);
                await messageModel.deleteMany({ conversationId });
                await reportModel.deleteMany({ type: "message", conversationId });
                return res.status(200).json({
                    success: true,
                    message: "Bạn là người cuối cùng. Nhóm đã bị xóa hoàn toàn."
                });
            }
        }

        // Nếu user là admin thì loại khỏi danh sách admin (danh sách id)
        if (Array.isArray(conversation.admins) && conversation.admins.length > 0) {
            conversation.admins = conversation.admins.filter(id => (id?.toString ? id.toString() : id + '') !== userId);
        }

        await conversation.save();

        return res.status(200).json({
            success: true,
            message: "Rời nhóm thành công."
        });

    } catch (error) {
        console.error("Lỗi khi rời nhóm chat:", error);
        return res.status(500).json({
            success: false,
            message: error && error.message ? error.message : String(error),
        });
    }
};

function getCloudinaryImageLink(
    url,
    croppedArea,
    size = 190,
    options = {}
) {
    if (!url) {
        return "https://res.cloudinary.com/dpztbd1zk/image/upload/v1758185440/noneAvatar_cyftwm.jpg";
    }
    const rawUrl = String(url).replace(/^"+|"+$/g, "");
    let area;
    try {
        area = typeof croppedArea === "string" ? JSON.parse(croppedArea) : croppedArea;
    } catch (e) {
        return rawUrl; // fallback
    }
    if (!area || area.width == null || area.height == null) {
        return rawUrl;
    }

    const { x, y, width, height } = area;
    let transform = `/upload/c_crop,x_${Math.round(x)},y_${Math.round(y)},w_${Math.round(width)},h_${Math.round(height)}/c_fill,w_${size},h_${size}`;

    if (options.rounded) {
        transform += ",r_max";
    }
    transform += "/";

    return rawUrl.replace("/upload/", transform);
}

export const getOnlineUser = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Không có userId, truy cập bị từ chối' });
        }

        // Lấy danh sách bạn bè accepted, giống getFriendList
        const relationships = await Relationship.find({
            $and: [
                {
                    $or: [
                        { requester: userId },
                        { recipient: userId }
                    ]
                },
                { status: 'accepted' }
            ]
        }).lean();

        const userIdStr = String(userId);
        const friendIds = relationships
            .map(rel => rel.requester.toString() === userIdStr ? rel.recipient : rel.requester)
            .map(id => id.toString());

        if (!friendIds.length) {
            return res.json({ success: true, friends: [] });
        }

        // Lấy từ Redis những user đang online (set "online_users")
        let onlineFriendIds = [];
        try {
            // Lấy tất cả ID user online từ redis
            const allOnlineIdsRaw = await redis.sMembers("online_users");
            // Lọc ra friendIds nào nằm trong online
            console.log(allOnlineIdsRaw)
            onlineFriendIds = friendIds.filter(fid => allOnlineIdsRaw.includes(fid));
        } catch (redisErr) {
            // Nếu lỗi redis, vẫn trả về rỗng
            console.error("Lỗi redis trong getOnlineUser:", redisErr);
            onlineFriendIds = [];
        }

        if (!onlineFriendIds.length) {
            return res.json({ success: true, friends: [] });
        }

        // Lấy profile name
        const profiles = await profileModel.find(
            { user: { $in: onlineFriendIds } },
            'user name'
        ).lean();
        // Lấy bio avatar, avatarCroppedArea
        const bios = await bioModel.find(
            { userid: { $in: onlineFriendIds } },
            'userid avatar avatarCroppedArea'
        ).lean();

        // Map userid -> bio
        const userIdToBio = {};
        for (const bio of bios) {
            userIdToBio[String(bio.userid)] = bio;
        }

        // Return object: id, name, avatar (already cropped), KHÔNG TRẢ avatarCroppedArea nữa
        const friends = profiles.map(profile => {
            const bio = userIdToBio[String(profile.user)];
            const avatarLink = getCloudinaryImageLink(
                bio?.avatar,
                bio?.avatarCroppedArea,
                40
            );
            return {
                id: String(profile.user),
                name: profile.name,
                avatar: avatarLink,
            };
        });

        return res.json({ success: true, friends });
    } catch (error) {
        console.error("Error in getOnlineUser:", error);
        res.status(500).json({ success: false, message: "Server error in getOnlineUser." });
    }
};

// Gửi/nhận tin nhắn tự chat, mỗi message là một bản ghi tự chat (1 document ~ 1 message)

// Thêm tin nhắn tự chat mới (theo model: 1 doc lưu nhiều messages)
exports.selfChat = async (req, res) => {
    try {
        const userId = req.user.id;
        const { text } = req.body;

        if (typeof text !== "string") {
            return res.status(400).json({ success: false, message: "Text is required and must be a string." });
        }

        // Tạo message mới từ user (type 'self')
        const selfMsg = {
            text,
            type: 'self',
            createdAt: new Date()
        };

        let updatedDoc = await selfChatModel.findOneAndUpdate(
            { userId },
            { $push: { messages: selfMsg } },
            { new: true, upsert: true }
        ).lean();

        // Nếu là @bot thì generate và push bot message, res message bot
        if (text.trim().startsWith("@bot")) {
            let prompt = `hãy trả lời bằng tiếng Việt: ${text.replace(/^@bot[\s]*/, "")}`;

            try {
                const result = await model.generateContent(prompt);
                const botText = result.response.text();
                if (typeof botText === "string" && botText.trim()) {
                    const botMsg = {
                        text: botText,
                        type: "bot",
                        createdAt: new Date()
                    };
                    updatedDoc = await selfChatModel.findOneAndUpdate(
                        { userId },
                        { $push: { messages: botMsg } },
                        { new: true }
                    ).lean();
                    // Lấy tin nhắn bot cuối cùng
                    const lastBotMsg = updatedDoc.messages && updatedDoc.messages[updatedDoc.messages.length - 1];
                    return res.json({
                        success: true,
                        message: lastBotMsg
                            ? {
                                _id: lastBotMsg._id,
                                userId: updatedDoc.userId,
                                text: lastBotMsg.text,
                                type: lastBotMsg.type,
                                createdAt: lastBotMsg.createdAt,
                            }
                            : null
                    });
                }
            } catch (botError) {
                // Nếu lỗi là model quá tải thì trả về bot trả lời "server đang quá tải"
                let isOverloaded =
                    botError &&
                    botError.message &&
                    botError.message.includes("Model AI đang bị quá tải, vui lòng thử lại sau");

                if (isOverloaded) {
                    const botMsg = {
                        text: "Model AI đang bị quá tải, vui lòng thử lại sau",
                        type: "bot",
                        createdAt: new Date()
                    };
                    updatedDoc = await selfChatModel.findOneAndUpdate(
                        { userId },
                        { $push: { messages: botMsg } },
                        { new: true }
                    ).lean();
                    // Lấy tin nhắn bot cuối cùng
                    const lastBotMsg = updatedDoc.messages && updatedDoc.messages[updatedDoc.messages.length - 1];
                    return res.json({
                        success: true,
                        message: lastBotMsg
                            ? {
                                _id: lastBotMsg._id,
                                userId: updatedDoc.userId,
                                text: lastBotMsg.text,
                                type: lastBotMsg.type,
                                createdAt: lastBotMsg.createdAt,
                            }
                            : null
                    });
                } else {
                    // Lỗi khác thì vẫn ném lỗi ra cho catch ngoài cùng xử lý
                    throw botError;
                }
            }
        }

        // Không có bot, chỉ trả về success
        return res.json({ success: true });

    } catch (error) {
        console.error("Error in selfChat:", error);
        res.status(500).json({ success: false, message: "Server error in selfChat.", error });
    }
};

// Lấy danh sách tin nhắn tự chat (phân trang/scroll), trả ra mảng messages (gần nhất trước)
exports.getSelfChats = async (req, res) => {
    try {
        const userId = req.user.id;
        const { cursorAt } = req.query;

        // Tìm doc cho user này
        const doc = await selfChatModel.findOne({ userId }).lean();

        let messages = doc && doc.messages ? doc.messages.slice() : [];

        // Sort giảm dần theo createdAt
        messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Phân trang theo cursorAt (createdAt < cursorAt)
        let paginated = [];
        if (cursorAt) {
            paginated = messages.filter(msg => new Date(msg.createdAt) < new Date(cursorAt));
        } else {
            paginated = messages;
        }

        // Lấy tối đa 20 tin nhắn (mới nhất trước), rồi đảo lại cho đúng thứ tự cũ nhất lên trước
        const pagedMessages = paginated.slice(0, 20).reverse();

        let cursorResponse = null;
        if (pagedMessages.length > 0 && paginated.length > 20) {
            // Nếu còn tin nhắn nữa phía trước
            cursorResponse = pagedMessages[0].createdAt;
        }

        res.json({
            success: true,
            messages: pagedMessages.map(msg => ({
                _id: msg._id,
                userId,
                text: msg.text,
                type: msg.type,
                createdAt: msg.createdAt,
            })),
            cursorAt: cursorResponse
        });
    } catch (error) {
        console.error("Error in getSelfChats:", error);
        res.status(500).json({ success: false, message: "Server error in getSelfChats." });
    }
};

exports.summaryGroupConversation = async (req, res) => {
    try {
        const { conversationId } = req.body;
        if (!conversationId) {
            return res.status(400).json({ success: false, message: "Missing conversationId" });
        }

        // Tìm các message thuộc conversationId này, sort giảm dần theo createdAt, lấy 20 bản ghi
        const messages = await messageModel.find({ conversationId })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        // Nếu không có message nào thì trả về đoạn chat này chưa có gì cả
        if (!messages || messages.length === 0) {
            return res.json({
                success: true,
                botText: "Đoạn chat này chưa có gì cả."
            });
        }

        // Đảo lại để cũ nhất lên trước
        const orderedMessages = messages.reverse();

        // Nối các text của tin nhắn lại với nhau (bỏ qua nếu không có text), cách nhau bởi dấu ;
        const concatenatedText = orderedMessages
            .map(msg => msg.text || "")
            .join("; ");
        const prompt = `Hãy tóm tắt đoạn chat sau bằng tiếng Việt, format tin nhắn tôi gửi cho bạn là mỗi tin nhắn cách nhau bởi 1 dấu chấm phẩy, tin nhắn từ cũ nhất đến mới nhất, chỉ cần tóm tắt đang nói về cái gì, không cần cụ thể ai: ${concatenatedText}`;
        let botText = "";
        try {
            const result = await model.generateContent(prompt);
            botText = result.response.text();
        } catch (error) {
            console.error("Error generating summary:", error);
            return res.status(500).json({ success: false, message: "Lỗi khi tóm tắt đoạn chat." });
        }

        // Log ra messages đã lấy được
        console.log("Latest 20 messages for conversationId", conversationId, concatenatedText);

        return res.json({
            success: true,
            botText
        });
    } catch (error) {
        console.error("Error in getLatestMessages:", error);
        res.status(500).json({ success: false, message: "Server error in getLatestMessages." });
    }
};
