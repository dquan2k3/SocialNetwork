import { bioModel } from "../model/bio";
const fs = require("fs");
const cloudinary = require('../config/cloudinaryConfig');
const streamifier = require("streamifier");
const jwt = require("jsonwebtoken");

/**
 * Uploads an image buffer to Cloudinary with a specific public_id.
 * @param {Buffer} fileBuffer - The image buffer.
 * @param {String} publicId - The public_id for Cloudinary (e.g., "username_avatar").
 * @returns {Promise<Object>} - The Cloudinary upload result.
 */
async function uploadImageBufferToCloudinary(fileBuffer, publicId) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "user-bio-images",
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

export const changeBio = async (req, res) => {
    try {
        const userId = req.user.id;

        // Hỗ trợ cả JSON và multipart/form-data
        let avatarChanged = false, coverChanged = false, descriptionChanged = false;
        let avatarFile = null, coverFile = null;
        let description = "";

        // croppedStat
        let avatarCroppedStat = null;
        let coverCroppedStat = null;

        // croppedArea
        let avatarCroppedArea = null;
        let coverCroppedArea = null;

        // Thêm biến cfNewAvatar, cfNewCover
        let cfNewAvatar = false, cfNewCover = false;

        // Xác định multipart/form-data
        const isMultipart = req.is && req.is('multipart/form-data');
        if (isMultipart) {
            avatarChanged = req.body && req.body.avatarChanged === 'true';
            coverChanged = req.body && req.body.coverChanged === 'true';
            descriptionChanged = req.body && req.body.descriptionChanged === 'true';
            description = (req.body && req.body.description) || "";

            cfNewAvatar = req.body && req.body.cfNewAvatar === 'true';
            cfNewCover = req.body && req.body.cfNewCover === 'true';

            // Avatar
            if (avatarChanged) {
                if (cfNewAvatar) {
                    avatarFile = req.files && req.files.avatar
                        ? (Array.isArray(req.files.avatar) ? req.files.avatar[0] : req.files.avatar)
                        : null;
                }
                avatarCroppedStat = {
                    zoom: req.body.avatarZoom !== undefined ? Number(req.body.avatarZoom) : null,
                    cropX: req.body.avatarCropX !== undefined ? Number(req.body.avatarCropX) : null,
                    cropY: req.body.avatarCropY !== undefined ? Number(req.body.avatarCropY) : null
                };

                avatarCroppedArea = {
                    x: Number(req.body.avatarCroppedAreaX),
                    y: Number(req.body.avatarCroppedAreaY),
                    width: Number(req.body.avatarCroppedAreaWidth),
                    height: Number(req.body.avatarCroppedAreaHeight)
                };
            }
            // Cover
            if (coverChanged) {
                if (cfNewCover) {
                    coverFile = req.files && req.files.cover
                        ? (Array.isArray(req.files.cover) ? req.files.cover[0] : req.files.cover)
                        : null;
                }
                coverCroppedStat = {
                    zoom: req.body.coverZoom !== undefined ? Number(req.body.coverZoom) : null,
                    cropX: req.body.coverCropX !== undefined ? Number(req.body.coverCropX) : null,
                    cropY: req.body.coverCropY !== undefined ? Number(req.body.coverCropY) : null
                };

                coverCroppedArea = {
                    x: Number(req.body.coverCroppedAreaX),
                    y: Number(req.body.coverCroppedAreaY),
                    width: Number(req.body.coverCroppedAreaWidth),
                    height: Number(req.body.coverCroppedAreaHeight)
                };
            }
        } else {
            // JSON: KHÔNG BAO GIỜ có file avatar/cover, chỉ chỉnh sửa crop/zoom nếu avatarChanged/coverChanged

            // Không cần cfNewAvatar/cfNewCover, không có file/base64
            // Avatar
            if (req.body?.avatar && typeof req.body.avatar === "object") {
                avatarChanged = !!req.body.avatar.changed;
                if (avatarChanged) {
                    avatarCroppedStat = {
                        zoom: req.body.avatar.zoom !== undefined ? req.body.avatar.zoom : null,
                        cropX: req.body.avatar.crop?.x !== undefined ? req.body.avatar.crop.x : null,
                        cropY: req.body.avatar.crop?.y !== undefined ? req.body.avatar.crop.y : null
                    };

                    const cap = req.body.avatar.croppedAreaPixels;
                    avatarCroppedArea = {
                        x: Number(cap.x),
                        y: Number(cap.y),
                        width: Number(cap.width),
                        height: Number(cap.height)
                    };
                }
            }

            // Cover
            if (req.body?.cover && typeof req.body.cover === "object") {
                coverChanged = !!req.body.cover.changed;
                if (coverChanged) {
                    coverCroppedStat = {
                        zoom: req.body.cover.zoom !== undefined ? req.body.cover.zoom : null,
                        cropX: req.body.cover.crop?.x !== undefined ? req.body.cover.crop.x : null,
                        cropY: req.body.cover.crop?.y !== undefined ? req.body.cover.crop.y : null
                    };

                    const cap = req.body.cover.croppedAreaPixels;
                    coverCroppedArea = {
                        x: Number(cap.x),
                        y: Number(cap.y),
                        width: Number(cap.width),
                        height: Number(cap.height)
                    };
                }
            }

            descriptionChanged = !!req.body?.descriptionChanged;
            description = req.body?.description || "";
        }

        if (!userId) {
            return res.status(400).json({ success: false, message: "Thiếu userId" });
        }

        let updateFields = {};

        // Xử lý avatar
        if (avatarChanged) {
            if (isMultipart && cfNewAvatar) {
                let avatarResult = null;
                if (avatarFile) {
                    // File upload
                    let fileBuffer;
                    if (avatarFile.buffer) {
                        fileBuffer = avatarFile.buffer;
                    } else if (avatarFile.path && fs.existsSync(avatarFile.path)) {
                        fileBuffer = fs.readFileSync(avatarFile.path);
                    }
                    if (!fileBuffer) {
                        return res.status(400).json({ success: false, message: "Dữ liệu avatar không hợp lệ" });
                    }
                    avatarResult = await uploadImageBufferToCloudinary(fileBuffer, `${userId}_avatar`);
                    updateFields.avatar = avatarResult.secure_url;
                } else {
                    // Nếu cfNewAvatar mà không có file thì set null
                    updateFields.avatar = null;
                }
            }

            // Lưu croppedStat cho avatar (merge, chỉ update field mới)
            if (
                avatarCroppedStat &&
                (typeof avatarCroppedStat.zoom === "number" || typeof avatarCroppedStat.zoom === "string" || avatarCroppedStat.zoom !== undefined) &&
                (typeof avatarCroppedStat.cropX === "number" || typeof avatarCroppedStat.cropX === "string" || avatarCroppedStat.cropX !== undefined) &&
                (typeof avatarCroppedStat.cropY === "number" || typeof avatarCroppedStat.cropY === "string" || avatarCroppedStat.cropY !== undefined)
            ) {
                updateFields.avatarCroppedStat = {
                    ...(updateFields.avatarCroppedStat || {}),
                    ...(avatarCroppedStat.zoom !== undefined ? { zoom: avatarCroppedStat.zoom !== null && !isNaN(Number(avatarCroppedStat.zoom)) ? Number(avatarCroppedStat.zoom) : null } : {}),
                    ...(avatarCroppedStat.cropX !== undefined ? { cropX: avatarCroppedStat.cropX !== null && !isNaN(Number(avatarCroppedStat.cropX)) ? Number(avatarCroppedStat.cropX) : null } : {}),
                    ...(avatarCroppedStat.cropY !== undefined ? { cropY: avatarCroppedStat.cropY !== null && !isNaN(Number(avatarCroppedStat.cropY)) ? Number(avatarCroppedStat.cropY) : null } : {})
                };
            }

            // Lưu croppedArea cho avatar (merge, chỉ update field mới)
            if (
                avatarCroppedArea &&
                (avatarCroppedArea.x !== undefined || avatarCroppedArea.y !== undefined || avatarCroppedArea.width !== undefined || avatarCroppedArea.height !== undefined)
            ) {
                updateFields.avatarCroppedArea = {
                    ...(updateFields.avatarCroppedArea || {}),
                    ...(avatarCroppedArea.x !== undefined ? { x: Number(avatarCroppedArea.x) } : {}),
                    ...(avatarCroppedArea.y !== undefined ? { y: Number(avatarCroppedArea.y) } : {}),
                    ...(avatarCroppedArea.width !== undefined ? { width: Number(avatarCroppedArea.width) } : {}),
                    ...(avatarCroppedArea.height !== undefined ? { height: Number(avatarCroppedArea.height) } : {})
                };
            }
        }

        // Xử lý cover
        if (coverChanged) {
            if (isMultipart && cfNewCover) {
                let coverResult = null;
                if (coverFile) {
                    let fileBuffer;
                    if (coverFile.buffer) {
                        fileBuffer = coverFile.buffer;
                    } else if (coverFile.path && fs.existsSync(coverFile.path)) {
                        fileBuffer = fs.readFileSync(coverFile.path);
                    }
                    if (!fileBuffer) {
                        return res.status(400).json({ success: false, message: "Dữ liệu cover không hợp lệ" });
                    }
                    coverResult = await uploadImageBufferToCloudinary(fileBuffer, `${userId}_cover`);
                    updateFields.cover = coverResult.secure_url;
                } else {
                    // Nếu cfNewCover mà không có file thì set null
                    updateFields.cover = null;
                }
            }
            // Nếu là JSON hoặc multipart mà không cfNewCover, chỉ update croppedStat/croppedArea, KHÔNG update cover, coverStat

            // Lưu croppedStat cho cover (merge, chỉ update field mới)
            if (
                coverCroppedStat &&
                (typeof coverCroppedStat.zoom === "number" || typeof coverCroppedStat.zoom === "string" || coverCroppedStat.zoom !== undefined) &&
                (typeof coverCroppedStat.cropX === "number" || typeof coverCroppedStat.cropX === "string" || coverCroppedStat.cropX !== undefined) &&
                (typeof coverCroppedStat.cropY === "number" || typeof coverCroppedStat.cropY === "string" || coverCroppedStat.cropY !== undefined)
            ) {
                updateFields.coverCroppedStat = {
                    ...(updateFields.coverCroppedStat || {}),
                    ...(coverCroppedStat.zoom !== undefined ? { zoom: coverCroppedStat.zoom !== null && !isNaN(Number(coverCroppedStat.zoom)) ? Number(coverCroppedStat.zoom) : null } : {}),
                    ...(coverCroppedStat.cropX !== undefined ? { cropX: coverCroppedStat.cropX !== null && !isNaN(Number(coverCroppedStat.cropX)) ? Number(coverCroppedStat.cropX) : null } : {}),
                    ...(coverCroppedStat.cropY !== undefined ? { cropY: coverCroppedStat.cropY !== null && !isNaN(Number(coverCroppedStat.cropY)) ? Number(coverCroppedStat.cropY) : null } : {})
                };
            }

            // Lưu croppedArea cho cover (merge, chỉ update field mới)
            if (
                coverCroppedArea &&
                (coverCroppedArea.x !== undefined || coverCroppedArea.y !== undefined || coverCroppedArea.width !== undefined || coverCroppedArea.height !== undefined)
            ) {
                updateFields.coverCroppedArea = {
                    ...(updateFields.coverCroppedArea || {}),
                    ...(coverCroppedArea.x !== undefined ? { x: Number(coverCroppedArea.x) } : {}),
                    ...(coverCroppedArea.y !== undefined ? { y: Number(coverCroppedArea.y) } : {}),
                    ...(coverCroppedArea.width !== undefined ? { width: Number(coverCroppedArea.width) } : {}),
                    ...(coverCroppedArea.height !== undefined ? { height: Number(coverCroppedArea.height) } : {})
                };
            }
        }

        // Xử lý description nếu có thay đổi
        if (descriptionChanged) {
            updateFields.description = description || "";
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(200).json({ success: true, message: "Không có thay đổi nào để cập nhật." });
        }

        // Log updateFields để debug
        console.log("==[changeBio] updateFields gửi vào DB==", updateFields);

        // Update bio in database, exclude _id from result
        const updatedBio = await bioModel.findOneAndUpdate(
            { userid: userId },
            { $set: updateFields },
            { 
                new: true, 
                upsert: true,
                projection: { _id: 0, userid: 0 }
            }
        );

        res.status(200).json({
            success: true,
            message: "Cập nhật bio thành công",
            bio: updatedBio
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: error && error.message ? error.message : String(error) });
    }
};

export const getBio = async (req, res) => {
    try {
        const userId = req.user.id;

        // Lấy bio nhưng loại trừ _id khi trả về
        const bioData = await bioModel.findOne(
            { userid: userId },
            'avatar cover avatarStat coverStat description avatarCroppedStat avatarCroppedArea coverCroppedStat coverCroppedArea -_id'
        );

        res.json({ success: true, bio: bioData });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
}

export const getBioFriendAvatar = async (req, res) => {
    try {
        const Id = req.body.Id;
        console.log(Id)
        const avatar = await bioModel.findOne(
            { userid: Id },
            'avatar avatarCroppedArea'
        );
        console.log(avatar)
        if (!avatar) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy avatar' });
        }
        res.json({ success: true, avatar: bio.avatar, avatarCroppedArea: bio.avatarCroppedArea });
    } catch (err) {
        console.log(err)
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
}

export const getCoverHome = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Không có userId, truy cập bị từ chối' });
        }
        // Lấy dữ liệu cover để trả về
        const coverData = await bioModel.findOne(
            { userid: userId },
            'cover coverCroppedArea -_id'
        );
        if (!coverData) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cover' });
        }
        res.json({ success: true, cover: coverData });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};
