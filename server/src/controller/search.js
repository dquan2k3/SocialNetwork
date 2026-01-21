import { profileModel } from '../model/profile';
import { bioModel } from '../model/bio.js';
import { Relationship } from '../model/relationship.js';
import { postCommentModel, postFileModel, postModel, postReactModel, postShareModel } from '../model/post.js';
import jwt from 'jsonwebtoken';

/**
 * Utility: map array to object keyed by idField, extracting only selected fields if given
 */
const mapById = (arr, idField = 'userid', fields = []) => {
    const res = {};
    for (const obj of arr) {
        let mapped = {};
        if (fields.length) {
            for (const field of fields) mapped[field] = obj[field];
        } else {
            Object.assign(mapped, obj);
        }
        res[String(obj[idField])] = mapped;
    }
    return res;
};

// Lấy ngẫu nhiên các user, kèm thông tin bio & relationship với current user nếu có (ngoại trừ bản thân)
export const getRandomUsers = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const userId = req.user?.id;

        const matchStage = userId ? { user: { $ne: userId } } : {};
        const randomProfiles = await profileModel.aggregate([
            { $match: matchStage },
            { $sample: { size: limit } },
            { $project: { user: 1, username: 1, name: 1, birthday: 1, hometown: 1 } }
        ]);
        let userIds = randomProfiles.map(p => String(p.user));

        if (userId) {
            userIds = userIds.filter(uid => uid !== String(userId));
        }

        // Lấy bio
        let bios = [];
        if (userIds.length > 0) {
            bios = await bioModel.find(
                { userid: { $in: userIds } },
                'userid avatar cover avatarCroppedArea coverCroppedArea'
            ).lean();
        }
        const userIdToBio = mapById(bios, 'userid', ['avatar', 'cover', 'avatarCroppedArea', 'coverCroppedArea']);

        // Lấy relationship
        // Cố định: trả về mảng (không phải null, không phải [] khi userIds length > 0)
        let relationships = [];
        if (userId && userIds.length > 0) {
            relationships = await Relationship.find({
                $or: [
                    { requester: userId, recipient: { $in: userIds } },
                    { recipient: userId, requester: { $in: userIds } }
                ]
            })
                .select('_id requester recipient status createdAt updatedAt') // Chỉ lấy field cần thiết
                .lean();
        }

        // mapping từ otherId = đối phương => relationship object
        const relMap = {};
        if (userId && relationships && relationships.length > 0) {
            for (let rel of relationships) {
                const requesterId = String(rel.requester);
                const recipientId = String(rel.recipient);
                // chỉ return 1 direction vì với current user chỉ có hướng tới các userIds
                if (requesterId === String(userId)) {
                    relMap[recipientId] = {
                        _id: rel._id,
                        requester: rel.requester,
                        recipient: rel.recipient,
                        status: rel.status,
                        createdAt: rel.createdAt,
                        updatedAt: rel.updatedAt
                    };
                } else if (recipientId === String(userId)) {
                    relMap[requesterId] = {
                        _id: rel._id,
                        requester: rel.requester,
                        recipient: rel.recipient,
                        status: rel.status,
                        createdAt: rel.createdAt,
                        updatedAt: rel.updatedAt
                    };
                }
            }
        }

        const result = randomProfiles
            .filter(profile => !userId || String(profile.user) !== String(userId))
            .map(profile => ({
                _id: profile._id,
                user: profile.user,
                username: profile.username,
                name: profile.name,
                birthday: profile.birthday || null,
                hometown: profile.hometown || null,
                bio: userIdToBio[String(profile.user)] || null,
                relationship: userId ? (relMap[String(profile.user)] || null) : null,
            }));

        console.log('[getRandomUsers] Kết quả trả về:', result); // Logging before return

        return res.status(200).json({ success: true, users: result });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: error && error.message ? error.message : String(error) });
    }
};

// Tìm kiếm user theo key + filter (age, location), trả thêm relationship cả giữa current user và các users tìm được, và cả mối quan hệ giữa các users tìm được với nhau
export const searchUser = async (req, res) => {
    try {
        const { key, filter } = req.body;
        const userId = req.user?.id;

        let query = {};
        const keyTrim = key && key.trim();
        if (keyTrim && keyTrim.startsWith('@')) {
            const username = keyTrim.slice(1);
            if (username) {
                query.username = { $regex: `^${username}$`, $options: "i" };
            }
        } else if (keyTrim) {
            query["$or"] = [
                { name: { $regex: key, $options: "i" } },
                { username: { $regex: key, $options: "i" } }
            ];
        }
        if (filter) {
            if (filter.location && filter.location.trim() !== "") {
                query.hometown = { $regex: filter.location, $options: "i" };
            }
            if (filter.age && typeof filter.age === "string" && filter.age.includes("-")) {
                const [minAgeStr, maxAgeStr] = filter.age.split("-");
                const minAge = parseInt(minAgeStr, 10);
                const maxAge = parseInt(maxAgeStr, 10);

                if (!isNaN(minAge) && !isNaN(maxAge)) {
                    const now = new Date();
                    const minBirth = new Date(now.getFullYear() - maxAge, now.getMonth(), now.getDate());
                    const maxBirth = new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate());
                    query.birthday = { $gte: minBirth, $lte: maxBirth };
                }
            }
        }
        if (userId) {
            query.user = { $ne: userId };
        }

        // Lấy profiles
        let profiles = await profileModel.find(query, {
            user: 1,
            username: 1,
            name: 1,
            birthday: 1,
            hometown: 1
        }).lean();

        if (userId) {
            profiles = profiles.filter(p => String(p.user) !== String(userId));
        }
        let userIds = profiles.map(p => String(p.user));
        if (userId) {
            userIds = userIds.filter(uid => uid !== String(userId));
        }

        // lấy bios
        let bios = [];
        if (userIds.length > 0) {
            bios = await bioModel.find(
                { userid: { $in: userIds } },
                'userid avatar cover avatarCroppedArea coverCroppedArea'
            ).lean();
        }
        const userIdToBio = mapById(bios, 'userid', ['avatar', 'cover', 'avatarCroppedArea', 'coverCroppedArea']);

        // lấy tất cả relationship giữa:
        // - currentUser <-> mỗi user tìm được
        // - giữa các user tìm được với nhau (song phương)
        let allUserIdsForRel = [...userIds];
        if (userId) allUserIdsForRel.push(String(userId));

        let allRelationships = [];
        if (allUserIdsForRel.length > 1) {
            // lấy tất cả relationship mà requester và recipient đều trong danh sách allUserIdsForRel
            allRelationships = await Relationship.find({
                requester: { $in: allUserIdsForRel },
                recipient: { $in: allUserIdsForRel }
            })
            .select('_id requester recipient status createdAt updatedAt')
            .lean();
        }

        // Map với current user: relMapCurrentUser[otherId] = {relationship...}
        // Map giữa users: relMapBetweenUsers: {"userId1|userId2": relationship}
        const relMapCurrentUser = {};
        const relMapBetweenUsers = {};

        if (allRelationships && allRelationships.length > 0) {
            allRelationships.forEach(rel => {
                const requesterId = String(rel.requester);
                const recipientId = String(rel.recipient);

                // Nếu liên quan tới current user thì lưu vào map user<->current
                if (userId && (requesterId === String(userId) || recipientId === String(userId))) {
                    const otherId = requesterId === String(userId) ? recipientId : requesterId;
                    relMapCurrentUser[otherId] = {
                        _id: rel._id,
                        requester: rel.requester,
                        recipient: rel.recipient,
                        status: rel.status,
                        createdAt: rel.createdAt,
                        updatedAt: rel.updatedAt
                    };
                } 
                // Lưu cả between users
                const pair1 = `${requesterId}|${recipientId}`;
                const pair2 = `${recipientId}|${requesterId}`;
                relMapBetweenUsers[pair1] = {
                    _id: rel._id,
                    requester: rel.requester,
                    recipient: rel.recipient,
                    status: rel.status,
                    createdAt: rel.createdAt,
                    updatedAt: rel.updatedAt
                };
                relMapBetweenUsers[pair2] = relMapBetweenUsers[pair1]; // Đảm bảo hai chiều
            });
        }

        // Build result trả về cho từng user
        const usersResult = profiles
            .filter(profile => !userId || String(profile.user) !== String(userId))
            .map(profile => ({
                _id: profile._id,
                user: profile.user,
                username: profile.username,
                name: profile.name,
                birthday: profile.birthday || null,
                hometown: profile.hometown || null,
                bio: userIdToBio[String(profile.user)] || null,
                relationship: userId ? (relMapCurrentUser[String(profile.user)] || null) : null
            }));

        // Build relationships giữa users tìm được
        // (trả về cho FE map {'userA|userB': relationship ...}, chỉ giữa các user tìm thấy, bỏ current user)
        const userPairsRelationships = {};
        for (let i = 0; i < userIds.length; ++i) {
            for (let j = i + 1; j < userIds.length; ++j) {
                const idA = userIds[i];
                const idB = userIds[j];
                const key = `${idA}|${idB}`;
                if (relMapBetweenUsers[key]) {
                    userPairsRelationships[key] = relMapBetweenUsers[key];
                }
            }
        }

        return res.status(200).json({ 
            success: true, 
            users: usersResult,
            relationshipsBetweenUsers: userPairsRelationships
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: error && error.message ? error.message : String(error) });
    }
};

// Tìm kiếm post tối ưu: relationship chỉ giữa currentUser và owner, giảm map/loop
export const searchPost = async (req, res) => {
    try {
        let { key = '', sort, filter = {} } = req.body || {};
        console.log('[searchPost] req.body', req.body);
        let sortby = sort || filter.sortby;
        let time = (filter && typeof filter === 'object') ? filter.time : undefined;

        let query = {};
        if (key && key.trim() !== '') {
            query.text = { $regex: key.trim(), $options: 'i' };
        }
        if (time && typeof time === 'string' && time.trim().length > 0) {
            let now = new Date();
            let targetDate = null;
            let matched = time.trim().match(/^(\d+)([hdwmy])$/i);
            if (matched) {
                let value = parseInt(matched[1], 10);
                let unit = matched[2].toLowerCase();
                switch (unit) {
                    case 'h':
                        targetDate = new Date(now.getTime() - value * 60 * 60 * 1000); break;
                    case 'd':
                        targetDate = new Date(now.getTime() - value * 24 * 60 * 60 * 1000); break;
                    case 'w':
                        targetDate = new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000); break;
                    case 'm':
                        now.setMonth(now.getMonth() - value); targetDate = now; break;
                    case 'y':
                        now.setFullYear(now.getFullYear() - value); targetDate = now; break;
                }
            }
            // fallback hỗ trợ cũ
            if (!targetDate) {
                if (time.includes('ngày trước')) {
                    let n = parseInt(time.trim().split(' ')[0], 10) || 1;
                    targetDate = new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
                } else if (time.includes('tuần trước') || time.includes('week')) {
                    let n = parseInt(time.trim().split(' ')[0], 10) || 1;
                    targetDate = new Date(now.getTime() - n * 7 * 24 * 60 * 60 * 1000);
                } else if (time.includes('tháng trước') || time.includes('month')) {
                    let n = parseInt(time.trim().split(' ')[0], 10) || 1;
                    now.setMonth(now.getMonth() - n);
                    targetDate = now;
                }
            }
            if (targetDate) {
                query.createdAt = { $gte: targetDate };
            }
        }
        let sortOpt = { createdAt: -1 };
        if (typeof sortby === 'string') sortby = sortby.trim().toLowerCase();
        if (sortby === 'asc' || sortby === 'oldest' || sortby === '1' || sortby === 1) {
            sortOpt = { createdAt: 1 };
        } else if (sortby === 'desc' || sortby === 'newest' || sortby === '-1' || sortby === -1) {
            sortOpt = { createdAt: -1 };
        }

        // Dùng id bản thân từ req.user?.id nếu có
        const userId = req.user?.id;

        // Lấy post và các user owner
        const posts = await postModel.find(query).sort(sortOpt).lean();
        const postIds = posts.map(p => p._id);
        const ownerUserIdsSet = new Set(posts.map(p => String(p.user)));
        const ownerUserIds = Array.from(ownerUserIdsSet);

        const [
            files,
            reactStats,
            myReacts,
            bios,
            profiles,
            relationships,
            shareStats,
            userShares,
            commentCountArr
        ] = await Promise.all([
            postIds.length ? postFileModel.find({ post_id: { $in: postIds } }).sort({ order_index: 1 }).lean() : [],
            postIds.length ? postReactModel.aggregate([
                { $match: { post: { $in: postIds } } },
                { $group: { _id: { post: "$post", react: "$react" }, count: { $sum: 1 } } }
            ]) : [],
            userId && postIds.length
                ? postReactModel.find({ post: { $in: postIds }, user: userId }).lean()
                : [],
            ownerUserIds.length
                ? bioModel.find(
                    { userid: { $in: ownerUserIds } },
                    'userid avatar cover avatarCroppedArea coverCroppedArea'
                ).lean() : [],
            ownerUserIds.length
                ? profileModel.find(
                    { user: { $in: ownerUserIds } },
                    'user username name'
                ).lean() : [],
            userId && ownerUserIds.length
                ? Relationship.find({
                    $or: [
                        { requester: userId, recipient: { $in: ownerUserIds } },
                        { recipient: userId, requester: { $in: ownerUserIds } }
                    ]
                })
                .select('_id requester recipient status createdAt updatedAt')
                .lean()
                : [],
            postIds.length ? postShareModel.aggregate([
                { $match: { post: { $in: postIds } } },
                { $group: { _id: "$post", count: { $sum: 1 } } }
            ]) : [],
            userId && postIds.length
                ? postShareModel.find({ post: { $in: postIds }, user: userId }).lean()
                : [],
            postIds.length ? postCommentModel.aggregate([
                { $match: { post: { $in: postIds } } },
                { $group: { _id: "$post", count: { $sum: 1 } } }
            ]) : []
        ]);

        const postIdToFiles = {};
        files.forEach(f => {
            const key = String(f.post_id);
            if (!postIdToFiles[key]) postIdToFiles[key] = [];
            postIdToFiles[key].push({ file_url: f.file_url, file_type: f.file_type, order_index: f.order_index });
        });
        const postIdToReactCounts = {};
        reactStats.forEach(stat => {
            const postId = String(stat._id.post);
            if (!postIdToReactCounts[postId])
                postIdToReactCounts[postId] = { like: 0, love: 0, fun: 0, sad: 0, angry: 0 };
            postIdToReactCounts[postId][stat._id.react] = stat.count;
        });
        const postIdToMyReact = {};
        myReacts.forEach(r => { postIdToMyReact[String(r.post)] = r.react; });
        const userIdToBio = mapById(bios, 'userid', ['avatar', 'cover', 'avatarCroppedArea', 'coverCroppedArea']);
        const userIdToProfile = mapById(profiles, 'user', ['username', 'name']);
        const ownerRelMap = {};

        if (userId && relationships && relationships.length > 0) {
            for (const rel of relationships) {
                const requesterId = String(rel.requester);
                const recipientId = String(rel.recipient);
                let otherId = null;
                if (requesterId === String(userId)) {
                    otherId = recipientId;
                } else if (recipientId === String(userId)) {
                    otherId = requesterId;
                }
                if (otherId) {
                    ownerRelMap[otherId] = {
                        _id: rel._id,
                        requester: rel.requester,
                        recipient: rel.recipient,
                        status: rel.status,
                        createdAt: rel.createdAt,
                        updatedAt: rel.updatedAt
                    };
                }
            }
        }
        const postIdToShareCount = {};
        shareStats.forEach(stat => { postIdToShareCount[String(stat._id)] = stat.count; });
        const hasShareMap = {};
        userShares.forEach(s => { hasShareMap[String(s.post)] = true; });
        const postIdToCommentCount = {};
        commentCountArr.forEach(stat => { postIdToCommentCount[String(stat._id)] = stat.count; });

        const result = posts.map(p => ({
            _id: p._id,
            user: p.user,
            text: p.text,
            privacy: p.privacy,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            files: postIdToFiles[String(p._id)] || [],
            reactCounts: postIdToReactCounts[String(p._id)] || { like: 0, love: 0, fun: 0, sad: 0, angry: 0 },
            myReact: userId ? (postIdToMyReact[String(p._id)] || null) : null,
            bioUser: userIdToBio[String(p.user)] || null,
            profileUser: userIdToProfile[String(p.user)] || null,
            relationship: userId ? (ownerRelMap[String(p.user)] || null) : null,
            hasShared: !!hasShareMap[String(p._id)],
            shareCount: postIdToShareCount[String(p._id)] || 0,
            commentCount: postIdToCommentCount[String(p._id)] || 0
        }));

        return res.status(200).json({ success: true, posts: result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error && error.message ? error.message : String(error) });
    }
};