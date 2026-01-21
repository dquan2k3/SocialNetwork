
import { groupModel, groupMemberModel, groupSettingModel } from '../model/group';
import { profileModel } from '../model/profile';
import { bioModel } from '../model/bio';
import { postModel, postFileModel } from '../model/post';
import { Relationship } from '../model/relationship';
import { postReactModel } from '../model/post';
import { postCommentModel } from '../model/post';
import { postShareModel } from '../model/post';

const fs = require("fs");
const cloudinary = require('../config/cloudinaryConfig');
const streamifier = require("streamifier");

/**
 * Uploads an image buffer to Cloudinary with a specific public_id.
 * Tương tự đoạn @bio.js (13-32)
 * @param {Buffer} fileBuffer - The image buffer.
 * @param {String} publicId - The public_id for Cloudinary (e.g., "groupid_cover").
 * @returns {Promise<Object>} - The Cloudinary upload result.
 */
async function uploadImageBufferToCloudinary(fileBuffer, publicId) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "group-covers",
                public_id: publicId,
                resource_type: "image",
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

function uploadFileBufferToCloudinary(fileBuffer, fileMimetype, publicId) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "posts",
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


/**
 * Test endpoint
 */
export const test = async (req, res) => {
    try {
        console.log("TEST");
        res.json({ success: true, test: "Test" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

/**
 * Tạo nhóm mới (chỉ nhận name, dữ liệu mặc định là public)
 * Yêu cầu: req.user.id (chủ nhóm), body chỉ chứa name
 * Quy tắc:
 *   - Tạo 1 document group mới
 *   - Gán owner là user hiện tại
 *   - Tạo 1 member là owner với trạng thái active và vai trò owner
 *   - Tạo 1 groupSetting cho nhóm đó (privacy mặc định 'public', requireApproval false)
 */
export const createGroup = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.json({ success: false, message: 'Không có userId, truy cập bị từ chối' });
        }

        const { name } = req.body;

        // Validate name
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.json({ success: false, message: 'Tên nhóm không hợp lệ' });
        }

        // Tạo group document (chỉ name, các field khác lấy mặc định của schema)
        const groupDoc = await groupModel.create({
            name: name.trim(),
            owner: userId
        });

        // Thêm thành viên chủ nhóm
        await groupMemberModel.create({
            groupId: groupDoc._id,
            userId: userId,
            role: 'owner',
            status: 'active',
            joinedAt: new Date(),
            requestedAt: new Date()
        });

        // Lưu cấu hình nhóm (privacy mặc định 'public', requireApproval mặc định false)
        await groupSettingModel.create({
            groupId: groupDoc._id,
            privacy: 'public',
            requireApproval: false
        });

        res.status(201).json({
            success: true,
            group: groupDoc
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

/**
 * Lấy danh sách nhóm mà user hiện tại là thành viên,
 * Trả về: _id, name, cover, isOwner (user có phải chủ nhóm, isOwner = 1 nếu là chủ nhóm, 0 nếu không), privacy
 * GET /api/my-groups
 * Nếu có truyền groupId, luôn include group này bất kể membership.
 */
export const getMyGroups = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.json({ success: false, message: 'Không có userId, truy cập bị từ chối' });
        }

        // Lấy groupId từ query (cho phép param groupId)
        const { groupId } = req.query;

        // Lấy tất cả membership của user
        const allMemberships = await groupMemberModel.find(
            { userId: userId },
            { groupId: 1, status: 1 }
        ).lean();

        let groupIds = allMemberships.map(m => String(m.groupId));

        // Nếu có groupId param, đảm bảo group này luôn có trong groupIds (kể cả nếu chưa là member)
        if (groupId && !groupIds.includes(String(groupId))) {
            groupIds.push(String(groupId));
        }

        // Lấy thông tin group - chỉ _id, name, cover, owner
        let groups = await groupModel.find(
            { _id: { $in: groupIds } },
            { _id: 1, name: 1, cover: 1, owner: 1 }
        ).lean();

        // Nhận groupId dạng string để so sánh sau
        const queryGroupIdStr = groupId ? String(groupId) : null;

        // Lấy privacy cho từng groupId từ groupSettingModel
        const settingsArr = await groupSettingModel.find(
            { groupId: { $in: groupIds } },
            { groupId: 1, privacy: 1 }
        ).lean();

        // Map groupId (string) -> privacy (string)
        const privacyMap = {};
        for (const setting of settingsArr) {
            privacyMap[String(setting.groupId)] = setting.privacy;
        }

        // Map groupId (string) -> status (string) của user
        const statusMap = {};
        for (const mem of allMemberships) {
            statusMap[String(mem.groupId)] = mem.status;
        }

        // Lấy số lượng thành viên cho từng group
        // Tối ưu: chỉ đếm các group cần trả ra thôi
        const groupIdsForCount = groups.map(g => g._id);
        const memberCounts = await groupMemberModel.aggregate([
            { $match: { groupId: { $in: groupIdsForCount } , status: { $ne: 'banned' }}},
            { $group: { _id: '$groupId', count: { $sum: 1 } } }
        ]);
        // Tạo map groupId -> count
        const countMap = {};
        for (const row of memberCounts) {
            countMap[String(row._id)] = row.count;
        }

        // Lọc: sẽ không trả group secret ngoại trừ khi đã là thành viên (có trong statusMap)
        groups = groups.filter(g => {
            const privacy = privacyMap[String(g._id)] || "public";
            const memberStatus = statusMap[String(g._id)];
            // Nếu là secret và chưa là member thì không trả
            if (privacy === "secret" && !memberStatus) {
                // Đặc biệt: nếu groupId truyền vào thì cũng không trả ra nếu là secret, trừ khi là member
                if (queryGroupIdStr && String(g._id) === queryGroupIdStr) {
                    // Không trả nếu chưa là member - đã rơi vào trường hợp !memberStatus, nên bỏ ra
                    return false;
                }
                // Không phải trường hợp groupId riêng, cũng không phải member: bỏ ra
                return false;
            }
            return true;
        });

        // Trả ra mảng group info, trả kèm isOwner, cover, privacy, status của bản thân, VÀ memberCount
        const result = groups.map(g => {
            const isOwner = g.owner && String(g.owner) === String(userId) ? 1 : 0;
            const status = statusMap[String(g._id)]; // undefined nếu chưa là member
            return {
                _id: g._id,
                name: g.name,
                cover: g.cover,
                isOwner: isOwner,
                privacy: privacyMap[String(g._id)] || "public",
                status: status, // "active", "pending", "banned" hoặc undefined (nếu chưa từng gửi join)
                memberCount: countMap[String(g._id)] || 0
            };
        });

        res.json({
            success: true,
            groups: result
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};


export const updateGroupCover = async (req, res) => {
    try {
        const { groupId, name } = req.body;
        console.log("updateGroupCover: groupId =", groupId, "name =", name, "req.file =", req.file);
        const userId = req.user?.id;
        if (!userId) {
            return res.json({ success: false, message: 'Chưa đăng nhập' });
        }
        if (!groupId) {
            return res.json({ success: false, message: 'Thiếu groupId' });
        }

        // Kiểm tra user có phải chủ nhóm không
        const group = await groupModel.findById(groupId);
        if (!group) {
            return res.json({ success: false, message: 'Không tìm thấy nhóm' });
        }
        if (String(group.owner) !== String(userId)) {
            return res.json({ success: false, message: 'Không có quyền thay đổi ảnh bìa nhóm' });
        }

        // Ảnh gửi lên qua field "cover"
        if (!req.file) {
            return res.json({ success: false, message: 'Thiếu file ảnh cover' });
        }

        // Sử dụng Cloudinary để upload ảnh cover giống bio.js
        const fileBuffer = req.file.buffer;
        if (!fileBuffer) {
            return res.json({ success: false, message: "Dữ liệu file không hợp lệ" });
        }

        // Đặt public_id để dễ quản lý: vd groupId_cover
        let cloudinaryResult;
        try {
            cloudinaryResult = await uploadImageBufferToCloudinary(fileBuffer, `${groupId}_cover`);
        } catch (uploadErr) {
            console.error(uploadErr);
            return res.status(500).json({ success: false, message: 'Lỗi server khi upload lên Cloudinary' });
        }

        const coverUrl = cloudinaryResult.secure_url;

        // Nếu gửi lên name mới (không phải chuỗi rỗng), thì cập nhật name luôn
        let newName = group.name; // Giữ lại tên gốc mặc định
        if (typeof name === "string" && name.trim() !== "") {
            group.name = name.trim();
            newName = name.trim();
        }
        // Cập nhật db
        group.cover = coverUrl;
        await group.save();

        // Log thông tin chính xác trước khi trả response
        console.log('updateGroupCover:', {
            groupId,
            cover: coverUrl,
            name: newName,
            user: userId
        });

        res.json({ success: true, message: 'Cập nhật ảnh bìa thành công', cover: coverUrl, name: newName });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật ảnh bìa' });
    }
};

// Cập nhật setting của group: description, privacy, requireApproval
export const updateGroupSetting = async (req, res) => {
    try {
        const { groupId, description, privacy, requireApproval } = req.body;
        const userId = req.user?.id;

        // Tìm groupSetting theo groupId (không phải _id)
        const groupSetting = await groupSettingModel.findOne({ groupId });
        if (!groupSetting) {
            return res.json({ success: false, message: "Cài đặt nhóm không tồn tại" });
        }

        // Chỉ cho phép admin hoặc owner của group thật sự thay đổi cài đặt
        // Kiểm tra owner và admins (đã lấy được model sẵn)
        const group = await groupModel.findById(groupId);
        if (!group) {
            return res.json({ success: false, message: "Nhóm không tồn tại" });
        }
        if (
            String(group.owner) !== String(userId) &&
            !(Array.isArray(group.admins) && group.admins.map(id => String(id)).includes(String(userId)))
        ) {
            return res.json({ success: false, message: "Không có quyền cập nhật cài đặt nhóm" });
        }

        // Chỉ cập nhật các trường hợp lệ
        if (typeof description === "string") {
            groupSetting.description = description.trim();
        }
        if (["public", "private", "secret"].includes(privacy)) {
            groupSetting.privacy = privacy;
        }
        if (typeof requireApproval === "boolean") {
            groupSetting.requireApproval = requireApproval;
        }

        await groupSetting.save();

        res.json({
            success: true,
            message: "Cập nhật cài đặt nhóm thành công",
            groupSetting: {
                groupId: groupSetting.groupId,
                description: groupSetting.description,
                privacy: groupSetting.privacy,
                requireApproval: groupSetting.requireApproval
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi server khi cập nhật cài đặt nhóm" });
    }
};

/**
 * Lấy cài đặt của một nhóm theo groupId.
 * Yêu cầu: query ?groupId=
 * Trả về: { success, groupSetting }
 */
export const getGroupSetting = async (req, res) => {
    try {
        const groupId = req.query.groupId;
        if (!groupId) {
            return res.json({ success: false, message: "Thiếu groupId" });
        }

        // Tìm group setting dựa trên groupId (TH không có trả về mặc định)
        const groupSetting = await groupSettingModel.findOne({ groupId });
        if (!groupSetting) {
            return res.json({ success: false, message: "Không tìm thấy cài đặt cho nhóm này" });
        }

        res.json({
            success: true,
            message: "Lấy cài đặt nhóm thành công",
            groupSetting: {
                groupId: groupSetting.groupId,
                description: groupSetting.description,
                privacy: groupSetting.privacy,
                requireApproval: groupSetting.requireApproval,
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi server khi lấy cài đặt nhóm" });
    }
};


export const searchGroup = async (req, res) => {
    try {
        const key = req.query.key || '';
        const type = req.query.type; // "", "public", "private" (optional)
        const sort = req.query.sort; // "most_members", "recent", "oldest" (optional)

        if (!key.trim()) {
            return res.json({ success: false, message: "Thiếu key" });
        }

        // Tạo match cho nhóm
        let match = {
            name: { $regex: key, $options: "i" }
        };

        // Lưu ý: privacy nằm ở groupSetting, phải $lookup mới lọc được (phức tạp hơn!)
        // Nếu có type (public/private), lọc luôn ở pipeline (sau khi lookup)
        let addTypeMatchStage = null;
        if (type && ["public", "private"].includes(type)) {
            addTypeMatchStage = {
                $match: { "setting.privacy": type }
            };
        }

        // Bước sort
        let sortStage = {};
        if (sort === "most_members") {
            sortStage = { membersCount: -1 };
        } else if (sort === "recent") {
            sortStage = { createdAt: -1 };
        } else if (sort === "oldest") {
            sortStage = { createdAt: 1 };
        }

        // Pipeline:
        let pipeline = [
            { $match: match },
            // Lấy setting (privacy/description)
            {
                $lookup: {
                    from: "groupsettings",
                    localField: "_id",
                    foreignField: "groupId",
                    as: "setting"
                }
            },
            {
                $addFields: {
                    setting: { $arrayElemAt: ["$setting", 0] }
                }
            },
            // Đếm số thành viên thực tế từ groupMemberModel (status: "active")
            {
                $lookup: {
                    from: "groupmembers",
                    let: { groupId: "$_id" },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ["$groupId", "$$groupId"] }, { $eq: ["$status", "active"] }] } } },
                        { $count: "total" }
                    ],
                    as: "membersArr"
                }
            },
            {
                $addFields: {
                    membersCount: {
                        $ifNull: [
                            { $arrayElemAt: ["$membersArr.total", 0] },
                            0
                        ]
                    }
                }
            },
        ];

        // Thêm lọc theo type nếu có
        if (addTypeMatchStage) {
            pipeline.push(addTypeMatchStage);
        }

        pipeline = pipeline.concat([
            {
                $project: {
                    _id: 1,
                    name: 1,
                    cover: 1,
                    privacy: { $ifNull: ["$setting.privacy", "public"] },
                    description: { $ifNull: ["$setting.description", ""] },
                    membersCount: 1,
                    createdDate: "$createdAt"
                }
            },
            { $sort: sortStage },
            { $limit: 30 }
        ]);

        const groups = await groupModel.aggregate(pipeline);

        // Định dạng kết quả trả về, bao gồm cover
        const result = groups.map(g => ({
            Id: g._id,
            name: g.name,
            cover: g.cover || "",
            privacy: g.privacy,
            description: g.description,
            membersCount: g.membersCount || 0,
            createdDate: g.createdDate
        }));

        res.json({
            success: true,
            groups: result
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi server khi tìm kiếm nhóm" });
    }
};

// Xử lý yêu cầu tham gia nhóm
exports.joinGroup = async (req, res) => {
    try {
        const { groupId, message } = req.body;
        // userId có thể nằm ở req.user.id hoặc req.user._id tùy auth, giữ cả 2 cách
        const userId = req.user.id || req.user._id;

        // Kiểm tra xem nhóm có tồn tại không
        const group = await groupModel.findById(groupId);
        if (!group) {
            return res.json({ success: false, message: "Nhóm không tồn tại", type: "not_found" });
        }

        // Kiểm tra nếu người dùng đã là thành viên hoặc đã gửi yêu cầu tham gia
        const existedMember = await groupMemberModel.findOne({
            groupId: groupId,
            userId: userId,
            // Chỉ kiểm tra trạng thái 'pending' (đã gửi yêu cầu) hoặc 'active' (là thành viên)
            status: { $in: ['pending', 'active'] }
        });

        if (existedMember) {
            if (existedMember.status === "pending") {
                return res.json({
                    success: true,
                    message: "Bạn đã gửi yêu cầu tham gia nhóm trước đó và đang chờ phê duyệt",
                    type: "pending"
                });
            }
            // Nếu đã là member (active), trả về thông báo
            return res.json({
                success: true,
                message: "Bạn đã là thành viên của nhóm này",
                type: "active"
            });
        }

        // Tạo mới bản ghi groupMember với trạng thái pending ("gửi yêu cầu tham gia")
        await groupMemberModel.create({
            groupId: groupId,
            userId: userId,
            role: 'member',
            status: 'pending',
            message: message || "",
            requestedAt: new Date()
            // joinedAt không set vì chưa duyệt
        });

        res.json({ success: true, message: "Đã gửi yêu cầu tham gia nhóm", type: "pending" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi server khi gửi yêu cầu tham gia nhóm", type: "error" });
    }
};

// Hủy yêu cầu tham gia nhóm
exports.cancelJoinGroup = async (req, res) => {
    try {
        const { groupId } = req.body;
        const userId = req.user.id || req.user._id;

        // Chỉ cho phép hủy nếu status là 'pending'
        const member = await groupMemberModel.findOne({
            groupId: groupId,
            userId: userId,
            status: 'pending'
        });

        if (!member) {
            return res.json({ success: false, message: "Không tìm thấy yêu cầu tham gia nhóm ở trạng thái chờ duyệt" });
        }

        await groupMemberModel.deleteOne({ _id: member._id });

        res.json({ success: true, message: "Đã hủy yêu cầu tham gia nhóm" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi server khi hủy yêu cầu tham gia nhóm" });
    }
};

// Rời khỏi nhóm
exports.leaveGroup = async (req, res) => {
    try {
        const { groupId } = req.body;
        const userId = req.user.id || req.user._id;

        // Nếu là owner thì không cho rời nhóm
        const group = await groupModel.findById(groupId);
        if (!group) {
            return res.json({ success: false, message: "Nhóm không tồn tại" });
        }
        if (group.owner && group.owner.toString() === userId.toString()) {
            return res.json({ success: false, message: "Chủ nhóm không thể rời nhóm" });
        }

        // Chỉ xóa với status là active (đã là thành viên)
        const member = await groupMemberModel.findOne({
            groupId: groupId,
            userId: userId,
            status: 'active'
        });

        if (!member) {
            return res.json({ success: false, message: "Bạn không phải là thành viên của nhóm này hoặc đã rời nhóm" });
        }

        await groupMemberModel.deleteOne({ _id: member._id });

        res.json({ success: true, message: "Đã rời khỏi nhóm" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi server khi rời nhóm" });
    }
};



exports.loadMember = async (req, res) => {
    try {
        const { groupId } = req.query;
        if (!groupId) {
            return res.json({ success: false, message: "Thiếu groupId" });
        }

        // Helper to enrich with bio + profile, and replace userId with user object in response
        async function enrichMembers(members) {
            const userIds = members.map(m => m.userId._id ? m.userId._id.toString() : m.userId.toString());
            const bios = await bioModel.find({ userid: { $in: userIds } }, { userid: 1, avatar: 1, avatarCroppedArea: 1 }).lean();
            const profiles = await profileModel.find({ user: { $in: userIds } }, { user: 1, name: 1 }).lean();

            // Convert to map for faster lookup
            const bioMap = {};
            bios.forEach(bio => { bioMap[bio.userid.toString()] = bio; });

            const profileMap = {};
            profiles.forEach(prof => { profileMap[prof.user.toString()] = prof; });

            return members.map(m => {
                const u = m.userId && typeof m.userId === "object" ? m.userId : {};
                const uid = u._id ? u._id.toString() : m.userId.toString();
                // Compose user object with userId (NOT _id), avatar, avatarCroppedArea, and name
                const user = {
                    userId: uid,
                    ...(u.email ? { email: u.email } : {}),
                    ...(u.username ? { username: u.username } : {}),
                    ...(u.active !== undefined ? { active: u.active } : {}),
                    avatar: bioMap[uid]?.avatar || null,
                    avatarCroppedArea: bioMap[uid]?.avatarCroppedArea || null,
                    name: profileMap[uid]?.name || null
                };
                return {
                    ...m._doc,
                    user: user,
                    bannedTill: m.bannedTill || null // add bannedTill explicitly
                };
            });
        }

        // Thành viên (status: 'active')
        let members = await groupMemberModel.find({ groupId: groupId, status: 'active' })
            .populate('userId', '-Password');
        // Pending (status: 'pending')
        let pending = await groupMemberModel.find({ groupId: groupId, status: 'pending' })
            .populate('userId', '-Password');
        // Banned (status: 'banned')
        let banned = await groupMemberModel.find({ groupId: groupId, status: 'banned' })
            .populate('userId', '-Password');

        members = await enrichMembers(members);
        pending = await enrichMembers(pending);
        banned = await enrichMembers(banned);

        // Remove userId field if present
        members = members.map(m => {
            const ret = { ...m };
            delete ret.userId;
            // bannedTill đã trả về từ enrichMembers
            return ret;
        });
        // pending sẽ trả về cả status pending và banned
        let pendingResult = [...pending, ...banned].map(m => {
            const ret = { ...m };
            delete ret.userId;
            // bannedTill đã trả về từ enrichMembers
            return ret;
        });

        res.json({
            success: true,
            members: members,
            pending: pendingResult,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi server khi tải thành viên nhóm" });
    }
};

// Chấp nhận thành viên vào nhóm
exports.acceptMember = async (req, res) => {
    try {
        const { groupId, userId } = req.body;
        const myUserId = req.user?.id;
        if (!groupId || !userId) {
            return res.json({ success: false, message: "Thiếu groupId hoặc userId" });
        }

        // Kiểm tra quyền Owner
        const group = await groupModel.findById(groupId);
        if (!group) {
            return res.json({ success: false, message: "Không tìm thấy nhóm" });
        }
        if (String(group.owner) !== String(myUserId)) {
            return res.json({ success: false, message: "Bạn không phải chủ nhóm, không có quyền thực hiện thao tác này" });
        }

        const groupMember = await groupMemberModel.findOne({ groupId, userId });

        if (!groupMember) {
            return res.json({ success: false, message: "Không tìm thấy thành viên trong nhóm" });
        }

        if (groupMember.status === 'active') {
            return res.json({ success: false, message: "Thành viên đã được chấp nhận" });
        }

        groupMember.status = 'active';
        await groupMember.save();

        res.json({ success: true, message: "Chấp nhận thành viên thành công" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi server khi chấp nhận thành viên" });
    }
};

// Từ chối thành viên vào nhóm
exports.rejectMember = async (req, res) => {
    try {
        const { groupId, userId } = req.body;
        const myUserId = req.user?.id;
        if (!groupId || !userId) {
            return res.json({ success: false, message: "Thiếu groupId hoặc userId" });
        }

        // Kiểm tra quyền Owner
        const group = await groupModel.findById(groupId);
        if (!group) {
            return res.json({ success: false, message: "Không tìm thấy nhóm" });
        }
        if (String(group.owner) !== String(myUserId)) {
            return res.json({ success: false, message: "Bạn không phải chủ nhóm, không có quyền thực hiện thao tác này" });
        }

        const groupMember = await groupMemberModel.findOne({ groupId, userId });

        if (!groupMember) {
            return res.json({ success: false, message: "Không tìm thấy thành viên trong nhóm" });
        }

        if (groupMember.status !== 'pending') {
            return res.json({ success: false, message: "Chỉ có thể từ chối thành viên đang chờ duyệt" });
        }

        await groupMemberModel.deleteOne({ groupId, userId });

        res.json({ success: true, message: "Đã từ chối thành viên này" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi server khi từ chối thành viên" });
    }
};

// Ban thành viên khỏi nhóm trong X ngày
exports.banMember = async (req, res) => {
    try {
        const { groupId, userId, days } = req.body;
        const myUserId = req.user?.id;
        if (!groupId || !userId || typeof days !== 'number' || days < 1) {
            return res.json({ success: false, message: "Thiếu groupId, userId hoặc số ngày ban không hợp lệ" });
        }

        // Kiểm tra quyền Owner
        const group = await groupModel.findById(groupId);
        if (!group) {
            return res.json({ success: false, message: "Không tìm thấy nhóm" });
        }
        if (String(group.owner) !== String(myUserId)) {
            return res.json({ success: false, message: "Bạn không phải chủ nhóm, không có quyền thực hiện thao tác này" });
        }

        const groupMember = await groupMemberModel.findOne({ groupId, userId });

        if (!groupMember) {
            return res.json({ success: false, message: "Không tìm thấy thành viên trong nhóm" });
        }

        // Gán trạng thái 'banned' và đặt thời hạn ban bằng trường bannedTill
        groupMember.status = 'banned';
        groupMember.bannedTill = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        await groupMember.save();

        res.json({ success: true, message: `Thành viên đã bị ban khỏi nhóm trong ${days} ngày` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Lỗi server khi ban thành viên" });
    }
};


exports.getGroupPosts = async (req, res) => {
    try {
        // Lấy groupId từ query (API truyền qua params)
        const groupId = req.query.groupId;
        const userId = req.user?.id || null;

        if (!groupId) {
            return res.json({ success: false, message: "Thiếu groupId" });
        }

        // Lấy thông tin setting nhóm
        const groupSetting = await groupSettingModel.findOne({ groupId });
        const groupPrivacy = groupSetting ? groupSetting.privacy : "public"; // default là public nếu không tìm thấy

        // Luôn kiểm tra nếu user đã đăng nhập và thuộc group và bị ban, thì không cho xem post (kể cả public group)
        let groupMember = null;
        if (userId) {
            groupMember = await groupMemberModel.findOne({
                groupId,
                userId: userId
            });

            // Kiểm tra bị cấm khỏi nhóm (ngay cả với nhóm public)
            if (groupMember && groupMember.status === 'banned') {
                let bannedTillStr;
                if (groupMember.bannedTill) {
                    const d = new Date(groupMember.bannedTill);
                    const pad = n => n.toString().padStart(2, '0');
                    let hours = d.getHours();
                    const mins = pad(d.getMinutes());
                    const secs = pad(d.getSeconds());
                    const ampm = hours >= 12 ? "pm" : "am";
                    hours = hours % 12;
                    if (hours === 0) hours = 12;
                    const timeStr = `${pad(hours)}:${mins}:${secs} ${ampm}`;
                    const dateStr = `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
                    bannedTillStr = `Bạn bị cấm khỏi nhóm này cho đến ${timeStr} ngày ${dateStr}`;
                } else {
                    bannedTillStr = 'Bạn bị cấm khỏi nhóm này.';
                }
                // Chỉ lỗi server với status 500, bình thường trả về 200 (theo guidline)
                return res.json({ success: false, message: bannedTillStr }); 
            }
        }

        // Nếu nhóm không phải public, chỉ active member mới xem được
        if (groupPrivacy !== "public") {
            if (!userId) {
                return res.json({ success: false, message: "Bạn phải là thành viên mới có quyền xem bài viết trong nhóm này" });
            }
            // groupMember đã lấy trước đó ở trên
            if (!groupMember || groupMember.status !== 'active') {
                return res.json({ success: false, message: "Bạn phải là thành viên mới có quyền xem bài viết trong nhóm này" });
            }
        }
        // Chỉ lấy các post thuộc groupId này
        const posts = await postModel.find({ groupId: groupId }).sort({ createdAt: -1 }).lean();
        const postIds = posts.map(p => p._id);

        const files = await postFileModel.find({ post_id: { $in: postIds } }).sort({ order_index: 1 }).lean();
        const postIdToFiles = {};
        for (const f of files) {
            const key = String(f.post_id);
            if (!postIdToFiles[key]) postIdToFiles[key] = [];
            postIdToFiles[key].push({ file_url: f.file_url, file_type: f.file_type, order_index: f.order_index });
        }

        const reactStats = await postReactModel.aggregate([
            { $match: { post: { $in: postIds } } },
            { $group: { _id: { post: "$post", react: "$react" }, count: { $sum: 1 } } }
        ]);
        const postIdToReactCounts = {};
        for (const stat of reactStats) {
            const postId = String(stat._id.post);
            const reactName = stat._id.react;
            if (!postIdToReactCounts[postId]) {
                postIdToReactCounts[postId] = { like: 0, love: 0, fun: 0, sad: 0, angry: 0 };
            }
            postIdToReactCounts[postId][reactName] = stat.count;
        }

        let postIdToMyReact = {};
        if (userId) {
            const myReacts = await postReactModel.find({ post: { $in: postIds }, user: userId }).lean();
            postIdToMyReact = {};
            myReacts.forEach(r => {
                postIdToMyReact[String(r.post)] = r.react;
            });
        }

        const userIds = [...new Set(posts.map(p => String(p.user)))];

        const bios = await bioModel.find(
            { userid: { $in: userIds } },
            'userid avatar cover avatarCroppedArea coverCroppedArea'
        ).lean();
        const userIdToBio = {};
        for (const bio of bios) {
            userIdToBio[String(bio.userid)] = {
                avatar: bio.avatar,
                cover: bio.cover,
                avatarCroppedArea: bio.avatarCroppedArea,
                coverCroppedArea: bio.coverCroppedArea
            };
        }

        const profiles = await profileModel.find(
            { user: { $in: userIds } },
            'user username name'
        ).lean();
        const userIdToProfile = {};
        for (const profile of profiles) {
            userIdToProfile[String(profile.user)] = {
                username: profile.username,
                name: profile.name
            };
        }

        let relationships = [];
        if (userIds.length > 0) {
            relationships = await Relationship.find({
                $or: [
                    { requester: { $in: userIds }, recipient: { $in: userIds } },
                    { recipient: { $in: userIds }, requester: { $in: userIds } }
                ]
            }).lean();
        }
        const relMap = {};
        for (const rel of relationships) {
            relMap[`${String(rel.requester)}_${String(rel.recipient)}`] = rel;
            relMap[`${String(rel.recipient)}_${String(rel.requester)}`] = rel;
        }

        const shareStats = await postShareModel.aggregate([
            { $match: { post: { $in: postIds } } },
            { $group: { _id: "$post", count: { $sum: 1 } } }
        ]);
        const postIdToShareCount = {};
        for (const stat of shareStats) {
            postIdToShareCount[String(stat._id)] = stat.count;
        }

        let hasShareMap = {};
        if (userId) {
            const userShares = await postShareModel.find({ post: { $in: postIds }, user: userId }).lean();
            userShares.forEach(s => {
                hasShareMap[String(s.post)] = true;
            });
        }

        const commentCountArr = await postCommentModel.aggregate([
            { $match: { post: { $in: postIds } } },
            { $group: { _id: "$post", count: { $sum: 1 } } }
        ]);
        const postIdToCommentCount = {};
        for (const stat of commentCountArr) {
            postIdToCommentCount[String(stat._id)] = stat.count;
        }

        const result = posts.map(p => {
            let relationship = null;
            if (userId) {
                if (relMap[`${String(userId)}_${String(p.user)}`]) {
                    relationship = relMap[`${String(userId)}_${String(p.user)}`];
                } else if (relMap[`${String(p.user)}_${String(userId)}`]) {
                    relationship = relMap[`${String(p.user)}_${String(userId)}`];
                }
            }
            const reactCounts = postIdToReactCounts[String(p._id)] || { like: 0, love: 0, fun: 0, sad: 0, angry: 0 };
            const myReact = userId ? (postIdToMyReact[String(p._id)] || null) : null;
            const hasShared = !!hasShareMap[String(p._id)];
            const shareCount = postIdToShareCount[String(p._id)] || 0;
            const commentCount = postIdToCommentCount[String(p._id)] || 0;

            return {
                _id: p._id,
                user: p.user,
                text: p.text,
                privacy: p.privacy,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
                files: postIdToFiles[String(p._id)] || [],
                reactCounts,
                myReact,
                bioUser: userIdToBio[String(p.user)] || null,
                profileUser: userIdToProfile[String(p.user)] || null,
                relationship: relationship
                    ? {
                        _id: relationship._id,
                        requester: relationship.requester,
                        recipient: relationship.recipient,
                        status: relationship.status
                    }
                    : null,
                hasShared,
                shareCount,
                commentCount
            };
        });

        // Always return 200 unless server error
        return res.json({ success: true, posts: result });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: error && error.message ? error.message : String(error) });
    }
};

export const uploadGroupPost = async (req, res) => {
    try {
        // userId from req.user.id (must be set before by middleware)
        const userId = req.user?.id;
        if (!userId) {
            return res.json({ success: false, message: "Thiếu userId" });
        }

        const text = req.body.text || '';
        const privacy = req.body.privacy || 'public';
        const files = req.files || [];
        const groupId = req.body.groupId; // lấy groupId từ body (từ apiUploadGroupPost)

        if (!groupId) {
            return res.json({ success: false, message: "Thiếu groupId" });
        }

        const newPost = await postModel.create({
            user: userId,
            groupId: groupId, // thêm groupId vào post
            text: text,
            privacy: privacy,
        });

        let fileResults = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let fileBuffer = null;
            if (file.buffer) {
                fileBuffer = file.buffer;
            } else if (file.path && fs.existsSync(file.path)) {
                fileBuffer = fs.readFileSync(file.path);
            }
            if (!fileBuffer) continue;
            const publicId = `post_${newPost._id}_${i}`;
            const uploadResult = await uploadFileBufferToCloudinary(fileBuffer, file.mimetype, publicId);
            const postFile = await postFileModel.create({
                post_id: newPost._id,
                file_url: uploadResult.secure_url,
                file_type: uploadResult.resource_type,
                order_index: i
            });
            fileResults.push({
                file_url: postFile.file_url,
                file_type: postFile.file_type,
                order_index: postFile.order_index
            });
        }

        console.log("Post uploaded:", {
            _id: newPost._id,
            user: newPost.user,
            groupId: newPost.groupId,
            text: newPost.text,
            privacy: newPost.privacy,
            createdAt: newPost.createdAt,
            updatedAt: newPost.updatedAt,
            files: fileResults
        });
        res.status(200).json({
            success: true,
            message: "Đăng bài thành công",
            post: {
                _id: newPost._id,
                user: newPost.user,
                groupId: newPost.groupId,
                text: newPost.text,
                privacy: newPost.privacy,
                createdAt: newPost.createdAt,
                updatedAt: newPost.updatedAt,
                files: fileResults
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: error && error.message ? error.message : String(error) });
    }
};

// Lấy media (images + videos) của một group cụ thể, có kiểm tra permission 
export const getGroupMedia = async (req, res) => {
    try {
        const groupId = req.query && req.query.groupId;
        const userId = req.user?.id || null;

        if (!groupId) {
            return res.status(400).json({ success: false, message: "Thiếu groupId" });
        }

        // Lấy thông tin setting nhóm
        const groupSetting = await groupSettingModel.findOne({ groupId });
        const groupPrivacy = groupSetting ? groupSetting.privacy : "public"; // default là public nếu không tìm thấy

        // Luôn kiểm tra nếu user đã đăng nhập và thuộc group và bị ban, thì không cho xem post (kể cả public group)
        let groupMember = null;
        if (userId) {
            groupMember = await groupMemberModel.findOne({
                groupId,
                userId: userId
            });

            // Kiểm tra bị cấm khỏi nhóm (ngay cả với nhóm public)
            if (groupMember && groupMember.status === 'banned') {
                let bannedTillStr;
                if (groupMember.bannedTill) {
                    const d = new Date(groupMember.bannedTill);
                    const pad = n => n.toString().padStart(2, '0');
                    let hours = d.getHours();
                    const mins = pad(d.getMinutes());
                    const secs = pad(d.getSeconds());
                    const ampm = hours >= 12 ? "pm" : "am";
                    hours = hours % 12;
                    if (hours === 0) hours = 12;
                    const timeStr = `${pad(hours)}:${mins}:${secs} ${ampm}`;
                    const dateStr = `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
                    bannedTillStr = `Bạn bị cấm khỏi nhóm này cho đến ${timeStr} ngày ${dateStr}`;
                } else {
                    bannedTillStr = 'Bạn bị cấm khỏi nhóm này.';
                }
                // Chỉ lỗi server với status 500, bình thường trả về 200 (theo guideline)
                return res.json({ success: false, message: bannedTillStr }); 
            }
        }

        // Nếu nhóm không phải public, chỉ active member mới xem được
        if (groupPrivacy !== "public") {
            if (!userId) {
                return res.json({ success: false, message: "Bạn phải là thành viên mới có quyền xem ảnh/video trong nhóm này" });
            }
            // groupMember đã lấy trước đó ở trên
            if (!groupMember || groupMember.status !== 'active') {
                return res.json({ success: false, message: "Bạn phải là thành viên mới có quyền xem ảnh/video trong nhóm này" });
            }
        }

        // Lấy các post thuộc groupId này (KHÔNG lấy post không thuộc group)
        const posts = await postModel.find({ groupId: groupId }).sort({ createdAt: -1 }).lean();
        if (!posts || posts.length === 0) {
            return res.status(200).json({ success: true, images: [], videos: [] });
        }

        const postIds = posts.map(post => post._id);

        // Lấy tất cả file liên quan tới postIds (post thuộc groupId)
        const allFiles = await postFileModel.find({
            post_id: { $in: postIds }
        }).lean();

        // Tìm image files
        const imageFiles = allFiles.filter(f => typeof f.file_type === "string" && f.file_type.toLowerCase().startsWith("image"));

        // Tìm video files
        const videoFiles = allFiles.filter(f => typeof f.file_type === "string" && f.file_type.toLowerCase().startsWith("video"));

        // Chuẩn bị images array
        const postIdToImageFiles = {};
        for (const file of imageFiles) {
            const pid = String(file.post_id);
            if (!postIdToImageFiles[pid]) postIdToImageFiles[pid] = [];
            postIdToImageFiles[pid].push(file);
        }
        const images = [];
        for (const post of posts) {
            const pid = String(post._id);
            const files = postIdToImageFiles[pid] || [];
            for (const file of files) {
                images.push({
                    url: cloudinary.url(file.file_url, { width: 185, height: 185, crop: "fill" }),
                    post_id: file.post_id
                });
            }
        }

        // Chuẩn bị videos array
        const videos = videoFiles.map(file => ({
            url: cloudinary.url(file.file_url, { resource_type: "video" }),
            post_id: file.post_id
        }));

        res.status(200).json({
            success: true,
            images,
            videos
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};
