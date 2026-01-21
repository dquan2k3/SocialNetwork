const Notification = require("../model/notification");
import { bioModel } from "../model/bio";
import { profileModel } from "../model/profile";

/**
 * Tạo link Cloudinary từ avatar, sử dụng thông tin cắt và tuỳ chọn.
 */
function getCloudinaryImageLink(url, croppedArea, size, options) {
    size = typeof size === "number" ? size : 190;
    options = options || {};
    if (!url) {
        return "https://res.cloudinary.com/dpztbd1zk/image/upload/v1758185440/noneAvatar_cyftwm.jpg";
    }
    const rawUrl = String(url).replace(/^"+|"+$/g, "");
    let area;
    try {
        area = typeof croppedArea === "string" ? JSON.parse(croppedArea) : croppedArea;
    } catch (e) {
        return rawUrl;
    }
    if (!area || area.width == null || area.height == null) {
        return rawUrl;
    }

    var x = area.x, y = area.y, width = area.width, height = area.height;
    var transform = "/upload/c_crop,x_" + Math.round(x) +
        ",y_" + Math.round(y) +
        ",w_" + Math.round(width) +
        ",h_" + Math.round(height) +
        "/c_fill,w_" + size + ",h_" + size;

    if (options.rounded) {
        transform += ",r_max";
    }
    transform += "/";

    return rawUrl.replace("/upload/", transform);
}

export const getNotifyList = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Không có userId, truy cập bị từ chối' });
        }

        // Lấy tối đa 50 thông báo, sắp xếp từ mới tới cũ
        let notifications = await Notification.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        // Lấy avatar cho mỗi from nếu có (from là userId gửi thông báo)
        const fromIds = Array.from(
            new Set(
                notifications
                    .filter(n => n.from)
                    .map(n => String(n.from))
            )
        );
        let bioMap = {};
        let nameMap = {};
        if (fromIds.length > 0) {
            const bios = await bioModel.find(
                { userid: { $in: fromIds } },
                "userid avatar avatarCroppedArea"
            ).lean();

            const profiles = await profileModel.find(
                { user: { $in: fromIds } },
                "user name"
            ).lean();

            for (let b of bios) {
                bioMap[String(b.userid)] = {
                    avatar: b.avatar,
                    avatarCroppedArea: b.avatarCroppedArea
                };
            }
            for (let p of profiles) {
                nameMap[String(p.user)] = p.name;
            }
        }

        const notificationsFormatted = notifications.map(n => {
            let avatar = "";
            let name = "";
            if (n.from && bioMap[String(n.from)]) {
                const { avatar: av, avatarCroppedArea } = bioMap[String(n.from)];
                avatar = getCloudinaryImageLink(av, avatarCroppedArea, 56);
            }
            if (n.from && nameMap[String(n.from)]) {
                name = nameMap[String(n.from)] || "";
            }
            return {
                ...n,
                avatar,
                name
            };
        });

        res.status(200).json({ notification: notificationsFormatted });
    } catch (err) {
        res.status(500).json({ message: "Lỗi khi lấy danh sách thông báo", error: err.message || String(err) });
    }
};


export const getMyAction = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Không có userId, truy cập bị từ chối' });
        }

        // Đọc cursor từ query
        const { cursor } = req.query;

        // Tạo điều kiện truy vấn
        let query = { from: userId };
        if (cursor) {
            // Cursor là createdAt, lấy các bản ghi cũ hơn
            query.createdAt = { $lt: new Date(cursor) };
        }

        // Lấy tối đa 5 hành động user này thực hiện (where: from = userId, [createdAt < cursor]), mới nhất đến cũ nhất
        const myActions = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        // Lấy user nhận action ('user' field, chính là người khác, KHÔNG phải mình)
        const toUserIds = Array.from(
            new Set(
                myActions
                    .filter(n => n.user)
                    .map(n => String(n.user))
            )
        );
        let bioMap = {};
        let nameMap = {};

        if (toUserIds.length > 0) {
            const bios = await bioModel.find(
                { userid: { $in: toUserIds } },
                "userid avatar avatarCroppedArea"
            ).lean();

            const profiles = await profileModel.find(
                { user: { $in: toUserIds } },
                "user name"
            ).lean();

            for (let b of bios) {
                bioMap[String(b.userid)] = {
                    avatar: b.avatar,
                    avatarCroppedArea: b.avatarCroppedArea
                };
            }
            for (let p of profiles) {
                nameMap[String(p.user)] = p.name;
            }
        }

        // Trả về danh sách notify - field avatar và name là của user nhận
        const actionsFormatted = myActions.map(n => {
            let avatar = "";
            let name = "";
            if (n.user && bioMap[String(n.user)]) {
                const { avatar: av, avatarCroppedArea } = bioMap[String(n.user)];
                avatar = getCloudinaryImageLink(av, avatarCroppedArea, 56);
            }
            if (n.user && nameMap[String(n.user)]) {
                name = nameMap[String(n.user)] || "";
            }
            return {
                ...n,
                avatar,
                name
            };
        });

        // nextCursor luôn là createdAt của bản ghi cuối cùng nếu có ít nhất 1 kết quả
        let nextCursor = null;
        if (myActions.length > 0) {
            nextCursor = myActions[myActions.length - 1].createdAt;
        }

        return res.status(200).json({ actions: actionsFormatted, nextCursor });
    } catch (err) {
        res.status(500).json({ message: "Lỗi khi lấy các hành động của user", error: err.message || String(err) });
    }
};