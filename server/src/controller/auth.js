import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { accountModel } from "../model/auth";
import { profileModel } from '../model/profile';
import { bioModel } from '../model/bio';
const redis = require("../config/redis");


export const updateLastSeen = async (userId) => {
    if (!userId) return;
    try {
        await accountModel.findByIdAndUpdate(
            userId, 
            { lastSeen: new Date() }, 
            { new: true }
        );
    } catch (err) {
        console.error('Error updating lastSeen:', err);
    }
};

export const updateLastSeen2126 = async (userId) => {
    if (!userId) return;
    try {
        const futureDate = new Date('2126-01-01T00:00:00Z');
        await accountModel.findByIdAndUpdate(
            userId, 
            { lastSeen: futureDate }, 
            { new: true }
        );
    } catch (err) {
        console.error('Error updating lastSeen to 2126:', err);
    }
};

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
        return rawUrl; // fallback
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

// Đăng ký tài khoản mới
export const register = async (req, res) => {
    const { email, password, rePassword, name } = req.body;
    console.log(name);

    try {
        // Kiểm tra tài khoản đã tồn tại chưa
        const existingUser = await accountModel.findOne({ Email: email });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Email đã được sử dụng' });
        }

        // Kiểm tra mật khẩu nhập lại
        if (password !== rePassword) {
            return res.status(400).json({ success: false, message: 'Mật khẩu nhập lại không khớp' });
        }

        // Hash mật khẩu
        const hashedPassword = await bcrypt.hash(password, 10);

        // Tạo tài khoản mới
        const newUser = await accountModel.create({
            Email: email,
            Password: hashedPassword,
        });

        await profileModel.findOneAndUpdate(
            { user: newUser._id },
            {
                name: name,
                user: newUser._id,
                nameChangedDate: new Date()
            },
            { new: true, upsert: true }
        );

        res.status(201).json({
            success: true,
            message: 'Đăng ký thành công',
            user: {
                id: newUser._id,
                email: newUser.Email,
                name: name,
                role: newUser.Role
            },
        });

    } catch (error) {
        console.error('Lỗi khi đăng ký:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Đăng nhập tài khoản
export const login = async (req, res) => {
    try {
        const { email, password, isKeepLogin } = req.body;
        const user = await accountModel.findOne({ Email: email });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Tài khoản không tồn tại' });
        }

        // Kiểm tra tình trạng ban
        if (user.banUntil && new Date(user.banUntil) > new Date()) {
            let reason = user.banReason ? ` vì: ${user.banReason}` : '';
            return res.status(403).json({
                success: false,
                message: `Tài khoản của bạn đã bị cấm${reason}.`
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.Password);

        if (!isPasswordValid) {
            return res.status(400).json({ success: false, message: 'Sai mật khẩu' });
        }

        // Lấy bio và profile
        const bio = await bioModel.findOne(
            { userid: user._id }, // userid là user._id
            'avatar avatarCroppedArea'
        );

        const info = await profileModel.findOne(
            { user: user._id },
            'name -_id'
        );

        const tokenPayload = {
            id: user._id,
            email: user.Email,
            role: user.Role,
            tokenVersion: user.tokenVersion, 
            avatar: getCloudinaryImageLink(bio?.avatar, bio?.avatarCroppedArea, 56),
            name: info?.name
        };

        let token;
        if (isKeepLogin) {
            token = jwt.sign(tokenPayload, process.env.JWT_SECRET);
            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                path : '/',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
        } else {
            token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1d' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                path: '/',
                sameSite: 'none'
            });
        }

        // Log the decoded token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded token:', decoded);

        // Set tokenVersion in redis after successful login
        await redis.set(`tokenVersion:${user._id}`, user.tokenVersion);

        return res.json({
            success: true,
            message: 'Đăng nhập thành công',
            user: {
                id: user._id,
                email: user.Email,
                role: user.Role,
                tokenVersion: user.tokenVersion 
            }
        });
    } catch (error) {
        console.error('Lỗi khi đăng nhập:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Đổi mật khẩu - tất cả lấy từ client, không kiểm tra xác thực
export const changePassword = async (req, res) => {
    try {
        // Lấy thông tin từ client gửi lên
        const { email, oldPassword, newPassword, reNewPassword } = req.body;

        if (!email || !oldPassword || !newPassword || !reNewPassword) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin.' });
        }

        if (newPassword !== reNewPassword) {
            return res.status(400).json({ success: false, message: 'Mật khẩu nhập lại không khớp.' });
        }

        if (oldPassword === newPassword) {
            return res.status(400).json({ success: false, message: 'Mật khẩu mới không được trùng với mật khẩu cũ.' });
        }

        // Tìm user theo email
        const user = await accountModel.findOne({ Email: email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy user.' });
        }

        // Kiểm tra mật khẩu cũ
        const isPasswordValid = await bcrypt.compare(oldPassword, user.Password);
        if (!isPasswordValid) {
            return res.status(400).json({ success: false, message: 'Mật khẩu cũ không đúng.' });
        }

        // Hash mật khẩu mới
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Cập nhật mật khẩu
        user.Password = hashedNewPassword;
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();

        // Cập nhật tokenVersion trong Redis (nếu dùng)
        await redis.set(`tokenVersion:${user._id}`, user.tokenVersion);

        // Xóa cookie hiện tại nếu có
        res.clearCookie('token', {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            path: '/'
        });

        return res.json({ success: true, message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' });
    } catch (error) {
        console.error('Lỗi khi đổi mật khẩu:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Check token và trả về user info nếu hợp lệ
// Đã có middleware verifyToken đảm bảo token hợp lệ và req.user có thông tin giải mã từ token
export const checklogin = async (req, res) => {
    try {
        // Lấy user id từ req.user (đã verify)
        const userId = req.user && req.user.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Không xác định được user từ token.' });
        }

        // Query lại user phòng trường hợp role hoặc thông tin bị thay đổi sau khi cấp token
        const user = await accountModel.findById(userId);
        if (!user) {
            return res.status(400).json({ success: false, message: 'Người dùng không tồn tại.' });
        }
        return res.json({
            success: true,
            message: 'Đăng nhập thành công',
            user: {
                id: user._id,
                email: user.Email,
                role: user.Role
            }
        });
    } catch (error) {
        console.error('Lỗi khi kiểm tra đăng nhập:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};


// JWT cho Socket.IO khi client và API khác domain (cookie không gửi được qua WS tới Render)
export const socketToken = (req, res) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ success: false, message: 'Missing token' });
    }
    return res.json({ success: true, token });
};

// Đăng xuất: Xóa token ở cookie
export const logout = (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/'
    });
    res.json({ success: true, message: 'Đăng xuất thành công' });
};
