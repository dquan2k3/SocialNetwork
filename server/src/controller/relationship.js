import jwt from 'jsonwebtoken';
import { profileModel } from '../model/profile.js';
import { bioModel } from '../model/bio.js';
import { accountModel } from '../model/auth.js';
const { Relationship } = require('../model/relationship');
import { notifyFriendRequest, notifyRemoveFriendRequest, notifyAcceptFriend } from './notification.js';

exports.sendFriendRequest = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Không có token, truy cập bị từ chối' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const myId = decoded.id;
        const avatar = req.user?.avatar;
        const name = req.user?.name;

        const { recipient, message } = req.body;

        if (!recipient) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin người nhận' });
        }
        if (myId === recipient) {
            return res.status(400).json({ success: false, message: 'Không thể gửi lời mời kết bạn cho chính mình' });
        }

        // Kiểm tra xem đã tồn tại mối quan hệ giữa 2 user này chưa (cả 2 chiều)
        let existing = await Relationship.findOne({
            $or: [
                { requester: myId, recipient: recipient },
                { requester: recipient, recipient: myId }
            ]
        });

        console.log(`[sendFriendRequest] myId: ${myId}, recipient: ${recipient}, message: ${message}`);
        console.log(existing)

        if (existing) {
            if (existing.status === 'blocked') {
                return res.status(403).json({ success: false, message: 'Không thể gửi lời mời kết bạn (bị chặn)', relationship: existing });
            }
            // Nếu đã tồn tại và status là pending, và requester không phải bản thân => chuyển sang accepted luôn
            if (existing.status === 'pending') {
                if (String(existing.requester) !== String(myId)) {
                    existing.status = 'accepted';
                    await existing.save();
                    return res.status(200).json({
                        success: true,
                        message: 'Đã chấp nhận lời mời kết bạn',
                        relationship: existing,
                    });
                } else {
                    // Nếu là pending và requester là bản thân, trả về đã pending
                    return res.status(409).json({ success: false, message: 'Đã gửi lời mời kết bạn trước đó, đang chờ phản hồi', relationship: existing });
                }
            }
            if (existing.status === 'accepted') {
                return res.status(409).json({ success: false, message: 'Hai bạn đã là bạn bè', relationship: existing });
            }
            // Nếu là rejected hoặc trạng thái khác, cho phép gửi lại

            // Nếu người gửi request mới khác với người gửi cũ, set wasRejected = false
            if (existing.status === 'rejected' || existing.wasRejected) {
                if (String(existing.requester) !== String(myId)) {
                    existing.wasRejected = false;
                }
            }

            // Cập nhật lại thông tin chung
            existing.requester = myId;
            existing.recipient = recipient;
            existing.message = message;
            existing.status = 'pending';

            await existing.save();

            // Lấy lại relationship mới nhất
            existing = await Relationship.findById(existing._id);

            // Gửi notification khi gửi lại lời mời kết bạn
            try {
                await notifyFriendRequest({
                    userId: recipient,
                    fromId: myId,
                    avatar,
                    name
                });
            } catch (err) {
                console.error("[sendFriendRequest][notifyFriendRequest] error:", err);
            }

            return res.status(200).json({
                success: true,
                message: 'Đã gửi lời mời kết bạn',
                relationship: existing,
            });
        }

        // Gán bản thân là requester, id truyền vào là recipient, trạng thái pending
        let relationship = new Relationship({
            requester: myId,
            recipient,
            message,
            status: 'pending'
        });

        await relationship.save();

        // Lấy lại relationship mới nhất
        relationship = await Relationship.findById(relationship._id);

        // Gửi notification sau khi tạo relationship mới
        try {
            await notifyFriendRequest({
                userId: recipient,
                fromId: myId,
                avatar,
                name
            });
        } catch (err) {
            console.error("[sendFriendRequest][notifyFriendRequest] error:", err);
        }

        return res.status(200).json({ success: true, message: 'Đã gửi lời mời kết bạn', relationship });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Lỗi server khi gửi lời mời kết bạn' });
    }
};

// Hàm lấy thông tin quan hệ giữa 2 user
exports.getRelationship = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Không có token, truy cập bị từ chối' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        const { otherUserId } = req.query;
        if (!otherUserId) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin người dùng cần kiểm tra' });
        }

        // Tìm quan hệ giữa userId và otherUserId (cả 2 chiều)
        const relationship = await Relationship.findOne({
            $or: [
                { requester: userId, recipient: otherUserId },
                { requester: otherUserId, recipient: userId }
            ]
        });

        if (!relationship) {
            return res.status(200).json({ success: true, relationship: null, message: 'Chưa có quan hệ' });
        }

        return res.status(200).json({ success: true, relationship });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy thông tin quan hệ' });
    }
};

// Hàm xóa quan hệ giữa user hiện tại và người khác (unfriend hoặc hủy lời mời)
exports.cancelRelationship = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Không có token, truy cập bị từ chối' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;
        const avatar = req.user?.avatar;
        const name = req.user?.name;

        const { relationshipId } = req.body;
        if (!relationshipId) {
            return res.status(400).json({ success: false, message: 'Thiếu relationshipId cần xóa' });
        }

        // Tìm relationship trước
        let relationship = await Relationship.findById(relationshipId);

        if (!relationship) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy quan hệ để xóa', relationship: null });
        }

        // Xác định người còn lại trong quan hệ
        const otherUserId = (String(relationship.requester) === String(userId))
            ? relationship.recipient
            : relationship.requester;

        // Nếu trạng thái là pending (đang chờ), coi là hủy lời mời kết bạn
        if (relationship.status === 'pending') {
            await Relationship.findOneAndDelete({ _id: relationshipId });
            // Thông báo realtime và xóa thông báo friendRequest phía bên nhận
            try {
                await notifyRemoveFriendRequest({
                    userId: otherUserId,
                    fromId: userId,
                    avatar,
                    name
                });
            } catch (err) {
                console.error("[cancelRelationship][notifyRemoveFriendRequest] error:", err);
            }
            return res.status(200).json({
                success: true,
                message: 'Đã hủy lời mời kết bạn',
                relationship: null
            });
        }

        // Nếu trạng thái là accepted (đã là bạn bè), coi là xóa bạn
        if (relationship.status === 'accepted') {
            await Relationship.findOneAndDelete({ _id: relationshipId });
            return res.status(200).json({
                success: true,
                message: 'Đã xóa bạn',
                relationship: null
            });
        }

        // Nếu trạng thái wasRejected = true, chuyển thành rejected thay vì xóa
        if (relationship.wasRejected === true) {
            relationship.status = 'rejected';
            await relationship.save();
            // Lấy lại relationship mới nhất
            relationship = await Relationship.findById(relationship._id);
            return res.status(200).json({
                success: true,
                message: 'Đã từ chối!',
                relationship
            });
        }

        // Nếu không, xóa relationship như bình thường
        const deletedRelationship = await Relationship.findOneAndDelete({
            _id: relationshipId,
        });

        if (!deletedRelationship) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy quan hệ để xóa', relationship: null });
        }

        res.status(200).json({
            success: true,
            message: 'Đã xóa',
            relationship: null
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Lỗi server', relationship: null });
    }
};

// Chấp nhận lời mời kết bạn (cập nhật trạng thái là 'accepted' nếu trạng thái là 'pending' và user hiện tại là recipient)
exports.acceptFriendRequest = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Không có token, truy cập bị từ chối' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;
        const avatar = req.user?.avatar;
        const name = req.user?.name;

        const { relationshipId } = req.body;
        if (!relationshipId) {
            return res.status(400).json({ success: false, message: 'Thiếu relationshipId cần chấp nhận' });
        }

        // Tìm relationship và kiểm tra quyền chấp nhận
        let relationship = await Relationship.findById(relationshipId);
        if (!relationship) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy lời mời kết bạn', relationship: null });
        }

        if (
            relationship.status !== 'pending' ||
            String(relationship.recipient) !== String(userId)
        ) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền chấp nhận lời mời này', relationship });
        }

        // Cập nhật trạng thái thành 'accepted' và lưu thời gian chấp nhận
        relationship.status = 'accepted';
        relationship.acceptedAt = new Date();
        relationship.wasRejected = false;
        await relationship.save();

        // Lấy lại relationship mới nhất
        relationship = await Relationship.findById(relationship._id);

        // Gửi thông báo tới requester (người đã gửi lời mời)
        await notifyAcceptFriend({
            userId: relationship.requester,
            fromId: userId,
            avatar,
            name,
        });

        res.status(200).json({
            success: true,
            message: 'Đã chấp nhận lời mời kết bạn thành công',
            relationship
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Lỗi server khi chấp nhận lời mời kết bạn', relationship: null });
    }
};


// Từ chối lời mời kết bạn (cập nhật trạng thái là 'rejected' và wasRejected = true nếu trạng thái là 'pending' và user hiện tại là recipient)
exports.rejectFriendRequest = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Không có token, truy cập bị từ chối' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        const { relationshipId } = req.body;
        if (!relationshipId) {
            return res.status(400).json({ success: false, message: 'Thiếu relationshipId cần từ chối' });
        }

        // Tìm relationship và kiểm tra quyền từ chối
        let relationship = await Relationship.findById(relationshipId);
        if (!relationship) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy lời mời kết bạn', relationship: null });
        }

        if (
            relationship.status !== 'pending' ||
            String(relationship.recipient) !== String(userId)
        ) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền từ chối lời mời này', relationship });
        }

        // Cập nhật trạng thái thành 'rejected' và wasRejected = true
        relationship.status = 'rejected';
        relationship.wasRejected = true;
        await relationship.save();

        // Lấy lại relationship mới nhất
        relationship = await Relationship.findById(relationship._id);

        res.status(200).json({
            success: true,
            message: 'Đã từ chối lời mời kết bạn thành công',
            relationship
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Lỗi server khi từ chối lời mời kết bạn', relationship: null });
    }
};

// Hàm block user: chuyển trạng thái relationship sang 'blocked' (nếu đã có relationship bất kỳ giữa hai user), nếu chưa có thì tạo mới
exports.blockUser = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Không có token, truy cập bị từ chối' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        const { userId: blockUserId } = req.body;
        if (!blockUserId) {
            return res.status(400).json({ success: false, message: 'Thiếu userId cần block' });
        }
        if (userId === blockUserId) {
            return res.status(400).json({ success: false, message: 'Không thể block chính mình' });
        }

        // Tìm tất cả các relationship giữa 2 user (cả 2 chiều)
        let relationship = await Relationship.findOne({
            $or: [
                { requester: userId, recipient: blockUserId },
                { requester: blockUserId, recipient: userId }
            ]
        });

        if (relationship) {
            // Nếu đã có relationship rồi, cập nhật lại status
            relationship.status = 'blocked';
            relationship.wasRejected = false;
            relationship.requester = userId; // người block là requester
            relationship.recipient = blockUserId;
            await relationship.save();
        } else {
            // Nếu chưa có, tạo mới relationship với trạng thái blocked
            relationship = await Relationship.create({
                requester: userId,
                recipient: blockUserId,
                status: 'blocked',
                wasRejected: false,
                message: '',
            });
        }

        // Lấy relationship mới nhất
        relationship = await Relationship.findById(relationship._id);

        res.status(200).json({
            success: true,
            message: 'Đã block người dùng thành công',
            relationship,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Lỗi server khi block người dùng', relationship: null });
    }
};


// Trả relationship cụ thể cho từng user nằm trong từng friend object thay vì mảng relationship ngoài

// getFriend giống code cũ, lấy danh sách bạn bè/lời mời liên quan của user hiện tại (req.user?.id)
// type = friend sẽ trả thêm lastSeen từ accountModel
exports.getFriend = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Không có userId, truy cập bị từ chối' });
        }

        // type truyền vào sẽ có 4 dạng: 'friend', 'requester', 'recipient', 'birthday'
        const type = req.query.type;
        console.log('type truyền vào:', type);

        let relationshipQuery = {};
        let mapUserIds = [];

        if (type === 'friend') {
            // accepted friends of user
            relationshipQuery = {
                $and: [
                    {
                        $or: [
                            { requester: userId },
                            { recipient: userId }
                        ]
                    },
                    { status: 'accepted' }
                ]
            };
            mapUserIds = (relationships, userIdStr) =>
                relationships
                    .map(rel =>
                        rel.requester.toString() === userIdStr ? rel.recipient : rel.requester
                    )
                    .map(id => id.toString());

        } else if (type === 'recipient') {
            relationshipQuery = {
                recipient: userId,
                status: 'pending'
            };
            mapUserIds = (relationships) =>
                relationships.map(rel => rel.requester.toString());

        } else if (type === 'requester') {
            relationshipQuery = {
                requester: userId,
                status: 'pending'
            };
            mapUserIds = (relationships) =>
                relationships.map(rel => rel.recipient.toString());

        } else if (type === 'birthday') {
            relationshipQuery = {
                $and: [
                    {
                        $or: [
                            { requester: userId },
                            { recipient: userId }
                        ]
                    },
                    { status: 'accepted' }
                ]
            };
            mapUserIds = (relationships, userIdStr) =>
                relationships
                    .map(rel =>
                        rel.requester.toString() === userIdStr ? rel.recipient : rel.requester
                    )
                    .map(id => id.toString());
        } else {
            return res.status(400).json({ success: false, message: 'Type không hợp lệ' });
        }

        const relationships = await Relationship.find(relationshipQuery).lean();
        console.log('[getFriend] relationships:', relationships);

        // Gán danh sách userId bạn bè/đối tượng cần lấy profile/bio
        const userIdStr = userId.toString();
        let friendIds = [];
        if (type === 'friend' || type === 'birthday') {
            friendIds = mapUserIds(relationships, userIdStr);
        } else if (type === 'recipient' || type === 'requester') {
            friendIds = mapUserIds(relationships);
        }

        if (!friendIds.length) {
            console.log('[getFriend] friends:', []);
            return res.json({ success: true, friends: [] });
        }

        let profileFields = 'user username name';
        if (type === 'birthday') {
            profileFields += ' birthday privatebirthday';
        }

        // Find profile and bios as before
        const profiles = await profileModel.find(
            { user: { $in: friendIds } },
            profileFields
        ).lean();
        console.log('[getFriend] profiles:', profiles);

        const bios = await bioModel.find(
            { userid: { $in: friendIds } }
        ).lean();
        console.log('[getFriend] bios:', bios);

        const userIdToBio = {};
        for (const bio of bios) {
            const { _id, userid, __v, ...rest } = bio;
            userIdToBio[String(bio.userid)] = rest;
        }

        const userIdToRelationship = {};
        if (type === 'friend' || type === 'birthday') {
            for (const rel of relationships) {
                const otherId = rel.requester.toString() === userIdStr ? rel.recipient.toString() : rel.requester.toString();
                userIdToRelationship[otherId] = rel;
            }
        } else if (type === 'recipient') {
            for (const rel of relationships) {
                userIdToRelationship[rel.requester.toString()] = rel;
            }
        } else if (type === 'requester') {
            for (const rel of relationships) {
                userIdToRelationship[rel.recipient.toString()] = rel;
            }
        }

        let lastSeenMap = {};
        if (type === 'friend' && friendIds.length) {
            // Trả thêm lastSeen cho mỗi id
            const accounts = await accountModel.find(
                { _id: { $in: friendIds } },
                "lastSeen"
            ).lean();
            lastSeenMap = {};
            for (const acc of accounts) {
                lastSeenMap[String(acc._id)] = acc.lastSeen || null;
            }
        }

        let friends = [];

        if (type === 'birthday') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            friends = profiles
                .filter(profile => {
                    if (profile.privatebirthday !== "public" || !profile.birthday) return false;

                    const nowYear = today.getFullYear();
                    const birthdayDate = new Date(profile.birthday);
                    const birtMonth = birthdayDate.getMonth();
                    const birtDay = birthdayDate.getDate();

                    let nextBirthday = new Date(nowYear, birtMonth, birtDay);
                    if (nextBirthday < today) {
                        nextBirthday = new Date(nowYear + 1, birtMonth, birtDay);
                    }
                    const diffMs = nextBirthday - today;
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    if (diffDays >= 0 && diffDays <= 29) {
                        profile.birthdayIn = diffDays;
                        return true;
                    }
                    return false;
                })
                .map(profile => ({
                    id: String(profile.user),
                    name: profile.name,
                    username: profile.username,
                    birthday: profile.birthday,
                    birthdayIn: profile.birthdayIn,
                    bio: userIdToBio[String(profile.user)] || null,
                    relationship: (userIdToRelationship[String(profile.user)] || null)
                }))
                .sort((a, b) => a.birthdayIn - b.birthdayIn);

        } else if (type === 'friend') {
            friends = profiles.map(profile => ({
                id: String(profile.user),
                name: profile.name,
                username: profile.username,
                bio: userIdToBio[String(profile.user)] || null,
                relationship: (userIdToRelationship[String(profile.user)] || null),
                lastSeen: lastSeenMap[String(profile.user)] || null
            }));
        } else {
            friends = profiles.map(profile => ({
                id: String(profile.user),
                name: profile.name,
                username: profile.username,
                bio: userIdToBio[String(profile.user)] || null,
                relationship: (userIdToRelationship[String(profile.user)] || null)
                // Không trả lastSeen cho các loại khác
            }));
        }

        console.log('[getFriend] friends:', friends);

        return res.json({ success: true, friends });
    } catch (error) {
        console.error("Error in getUserFriend:", error);
        res.status(500).json({ success: false, message: "Server error in getUserFriend." });
    }
};


// Thêm hàm getUserFriend: truyền userId (và type), sẽ load danh sách friend của userId truyền vào,
// nhưng mỗi user trong danh sách sẽ trả về relationship (giữa user hiện tại và từng người đó)

exports.getUserFriend = async (req, res) => {
    try {
        const viewerId = req.user?.id; // user hiện tại
        if (!viewerId) {
            return res.status(401).json({ success: false, message: 'Không có userId, truy cập bị từ chối' });
        }
        const { userId, type } = req.query;
        console.log('[getUserFriend] query:', req.query, 'viewerId:', viewerId);
        if (!userId || !type) {
            return res.status(400).json({ success: false, message: 'Thiếu userId hoặc type' });
        }

        let relationshipQuery = {};
        let mapUserIds = [];

        // Chỉ hỗ trợ type: 'friend', 'mutual'
        if (type === 'friend') {
            relationshipQuery = {
                $and: [
                    {
                        $or: [
                            { requester: userId },
                            { recipient: userId }
                        ]
                    },
                    { status: 'accepted' }
                ]
            };
            // Lấy id danh sách friend của userId truyền vào
            mapUserIds = (relationships, userIdStr) =>
                relationships
                    .map(rel =>
                        rel.requester.toString() === userIdStr ? rel.recipient : rel.requester
                    )
                    .map(id => id.toString());

        } else if (type === 'mutual') {
            // mutual friends giữa viewer (người xem) và userId truyền vào
            const [friendsOfUser, friendsOfViewer] = await Promise.all([
                Relationship.find({
                    $and: [
                        {
                            $or: [
                                { requester: userId },
                                { recipient: userId }
                            ]
                        },
                        { status: 'accepted' }
                    ]
                }).lean(),
                Relationship.find({
                    $and: [
                        {
                            $or: [
                                { requester: viewerId },
                                { recipient: viewerId }
                            ]
                        },
                        { status: 'accepted' }
                    ]
                }).lean()
            ]);
            const userIdStr = userId.toString();
            const viewerIdStr = viewerId.toString();

            // Tạo set bạn bè của từng người
            const friends1 = new Set(
                friendsOfUser.map(rel =>
                    rel.requester.toString() === userIdStr ? rel.recipient.toString() : rel.requester.toString()
                )
            );
            const friends2 = new Set(
                friendsOfViewer.map(rel =>
                    rel.requester.toString() === viewerIdStr ? rel.recipient.toString() : rel.requester.toString()
                )
            );
            // Mutual friend ids
            const mutualIds = Array.from([...friends1].filter(x => friends2.has(x)));

            // Không có mutual
            if (mutualIds.length === 0) {
                return res.json({ success: true, friends: [] });
            }

            // Lấy profile & bio bạn chung
            const profiles = await profileModel.find(
                { user: { $in: mutualIds } },
                'user username name'
            ).lean();
            const bios = await bioModel.find(
                { userid: { $in: mutualIds } }
            ).lean();

            const userIdToBio = {};
            for (const bio of bios) {
                const { _id, userid, __v, ...rest } = bio;
                userIdToBio[String(bio.userid)] = rest;
            }

            // Query tất cả relationship giữa viewer và từng mutual friend
            const relationships = await Relationship.find({
                $or: mutualIds.map(fid => [
                    { requester: viewerId, recipient: fid },
                    { requester: fid, recipient: viewerId }
                ]).flat()
            }).lean();

            const userIdToRelationship = {};
            for (const rel of relationships) {
                const otherId = rel.requester.toString() === viewerId.toString() ? rel.recipient.toString() : rel.requester.toString();
                userIdToRelationship[otherId] = rel;
            }

            const friends = profiles.map(profile => ({
                id: String(profile.user),
                name: profile.name,
                username: profile.username,
                bio: userIdToBio[String(profile.user)] || null,
                relationship: (userIdToRelationship[String(profile.user)] || null)
            }));
            return res.json({ success: true, friends });
        } else {
            return res.status(400).json({ success: false, message: 'Type không hợp lệ (phải là friend hoặc mutual)' });
        }

        // Tới đây TRƯỜNG HỢP TYPE 'friend' (không phải mutual)
        const relationships = await Relationship.find(relationshipQuery).lean();
        const userIdStr = userId.toString();
        let friendIds = mapUserIds(relationships, userIdStr);

        if (!friendIds.length) {
            return res.json({ success: true, friends: [] });
        }

        // Lấy profile/bio của bạn bè của userId truyền vào
        const profiles = await profileModel.find(
            { user: { $in: friendIds } },
            'user username name'
        ).lean();
        const bios = await bioModel.find(
            { userid: { $in: friendIds } }
        ).lean();

        const userIdToBio = {};
        for (const bio of bios) {
            const { _id, userid, __v, ...rest } = bio;
            userIdToBio[String(bio.userid)] = rest;
        }

        // Lấy tất cả quan hệ giữa viewerId và friendIds: dùng để biết viewer với từng bạn bè này có quan hệ gì
        const relationshipsBetween = await Relationship.find({
            $or: friendIds.map(fid => [
                { requester: viewerId, recipient: fid },
                { requester: fid, recipient: viewerId }
            ]).flat()
        }).lean();

        const userIdToRelationship = {};
        for (const rel of relationshipsBetween) {
            const otherId = rel.requester.toString() === viewerId.toString() ? rel.recipient.toString() : rel.requester.toString();
            userIdToRelationship[otherId] = rel;
        }

        const friends = profiles.map(profile => ({
            id: String(profile.user),
            name: profile.name,
            username: profile.username,
            bio: userIdToBio[String(profile.user)] || null,
            relationship: (userIdToRelationship[String(profile.user)] || null)
        }));

        return res.json({ success: true, friends });
    } catch (error) {
        console.error("Error in getUserFriend:", error);
        res.status(500).json({ success: false, message: "Server error in getUserFriend." });
    }
};

