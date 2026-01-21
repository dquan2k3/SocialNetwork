import { profileModel, contactModel, eventModel } from '../model/profile';
import { bioModel } from '../model/bio';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
const fs = require("fs");
const cloudinary = require('../config/cloudinaryConfig');
const streamifier = require("streamifier");
const { Relationship } = require('../model/relationship');

// Lấy userId từ req.body thay vì req.params

// @profile.js (38-45): lấy relationship như sau:
// Relationship.findOne({ $or: [{ requester: userId, recipient: currentUserId }, { requester: currentUserId, recipient: userId }] })

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: "Thiếu userId" });
    }

    // Lấy profile (name, username) và bio
    const [profile, bio] = await Promise.all([
      profileModel.findOne({ user: userId }, 'name username').lean(),
      bioModel.findOne(
        { userid: userId },
        'avatar cover avatarStat coverStat description avatarCroppedStat avatarCroppedArea coverCroppedStat coverCroppedArea'
      ),
    ]);

    // Lấy relationship
    let relationship = null;
    const currentUserId = req.user?.id;

    if (currentUserId) {
      // Relationship: lấy khi requester/recipient là userId và người còn lại là currentUserId
      const rel = await Relationship.findOne({
        $or: [
          { requester: userId, recipient: currentUserId },
          { requester: currentUserId, recipient: userId }
        ]
      })
      .select('requester recipient status message acceptedAt wasRejected blockedBy isFollow interactionCount lastInteractionAt createdAt updatedAt')
      .lean();

      if (rel) {
        relationship = rel;
      }
    }

    if (!profile) {
      return res.status(404).json({ success: false, message: "Không tìm thấy profile" });
    }

    res.status(200).json({
      success: true,
      profile,
      bio,
      relationship // Trả về 1 object duy nhất hoặc null: chỉ trả về nếu mối quan hệ này là giữa userId và currentUserId
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const changeUsername = async (req, res) => {
  try {
    const { username } = req.body;
    const userId = req.user.id;

    if (!username) {
      return res.status(400).json({ success: false, message: "Thiếu username" });
    }

    // Lấy profile hiện tại để kiểm tra thời gian đổi username gần nhất
    const currentProfile = await profileModel.findOne({ user: userId });
    if (currentProfile && currentProfile.usernameChangedDate) {
      const now = new Date();
      const changedDate = new Date(currentProfile.usernameChangedDate);
      const daysSinceChange = Math.floor((now - changedDate) / (1000 * 60 * 60 * 24));
      if (daysSinceChange < 30) {
        const daysLeft = 30 - daysSinceChange;
        console.error(`[changeUsername] Username change too soon: ${daysSinceChange} days since last change, ${daysLeft} days left.`);
        return res.status(403).json({
          success: false,
          message: `Chờ ${daysLeft} ngày nữa mới có thể thay đổi tiếp.`
        });
      }
    }

    // Kiểm tra username này đã được sử dụng chưa
    const existingProfile = await profileModel.findOne({ username });
    if (existingProfile && existingProfile.user.toString() !== userId) {
      return res.status(409).json({ success: false, message: "Username đã được sử dụng" });
    }

    // Thêm usernameChangedDate khi cập nhật username
    const updatedProfile = await profileModel.findOneAndUpdate(
      { user: userId },
      { 
        username, 
        usernameChangedDate: new Date() 
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Cập nhật username thành công",
      profile: updatedProfile
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const changeName = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    // Thêm nameChangedDate khi cập nhật tên
    const updatedProfile = await profileModel.findOneAndUpdate(
      { user: userId },
      { 
        name: name, 
        user: userId,
        nameChangedDate: new Date()
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Cập nhật tên thành công',
      profile: updatedProfile
    });

  } catch (error) {
    console.log(error)
    res.status(401).json({ success: false, message: error });
  }
}

export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await profileModel.findOne(
      { user: userId },
      { 
        name: 1, 
        username: 1, 
        nameChangedDate: 1, 
        usernameChangedDate: 1, 
        _id: 0 
      }
    );
    if (!profile) {
      return res.status(404).json({ success: false, message: "Không tìm thấy user" });
    }
    res.status(200).json({
      success: true,
      userId: userId,
      name: profile.name || '',
      username: profile.username || '',
      nameChangedDate: profile.nameChangedDate || null,
      usernameChangedDate: profile.usernameChangedDate || null
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
}



export const changeLiving = async (req, res) => {
  try {
    const { living, dateLiving, privateLiving } = req.body;
    const userId = req.user.id;

    const updatedProfile = await profileModel.findOneAndUpdate(
      { user: userId },
      {
        living: living,
        dateliving: dateLiving,
        privateliving: privateLiving,
        user: userId
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Cập nhật nơi ở thành công',
      profile: updatedProfile
    });

  } catch (error) {
    console.log(error)
    res.status(401).json({ success: false, message: error });
  }
}

export const changeHometown = async (req, res) => {
  try {
    const { hometown, privateHometown } = req.body;
    const userId = req.user.id;

    const updatedProfile = await profileModel.findOneAndUpdate(
      { user: userId },
      {
        hometown: hometown,
        privatehometown: privateHometown,
        user: userId
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Cập nhật quê quán thành công',
      profile: updatedProfile
    });

  } catch (error) {
    console.log(error)
    res.status(401).json({ success: false, message: error });
  }
}

export const changeBirthDay = async (req, res) => {
  try {
    const { birthday, privateBirthday } = req.body;
    const userId = req.user.id;

    const updatedProfile = await profileModel.findOneAndUpdate(
      { user: userId },
      {
        birthday: birthday,
        privatebirthday: privateBirthday,
        user: userId
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Cập nhật ngày sinh thành công',
      profile: updatedProfile
    });

  } catch (error) {
    console.log(error)
    res.status(401).json({ success: false, message: error });
  }
}

export const changeSchool = async (req, res) => {
  try {
    const { school, privateSchool, graduated } = req.body;
    const userId = req.user.id;

    const updatedProfile = await profileModel.findOneAndUpdate(
      { user: userId },
      {
        school: school,
        privateSchool: privateSchool,
        graduated: graduated,
        user: userId
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Cập nhật trường học thành công',
      profile: updatedProfile
    });

  } catch (error) {
    console.log(error)
    res.status(401).json({ success: false, message: error });
  }
}


export const getInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const info = await profileModel.findOne(
      { user: userId },
      'name username -_id user'
    );

    if (!info) return res.status(404).json({ success: false, message: 'Không tìm thấy profile' });

    res.json({ success: true, info });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

export const getProfile = async (req, res) => {
  try {
    // Nếu được truyền userId sẽ lấy profile của userId đó, còn không sẽ lấy user hiện tại
    const requestUserId = req.body.userId;
    const currentUserId = req.user.id;

    let profile;
    if (requestUserId && requestUserId !== currentUserId) {
      // Truy vấn profile user khác
      profile = await profileModel.findOne({ user: requestUserId }).lean();

      if (!profile) {
        return res.json({ success: true, profile: {} });
      }

      // Ẩn các trường private nếu private = 'private'
      const filteredProfile = { ...profile };

      if (filteredProfile.privateliving === 'private') filteredProfile.living = undefined;
      if (filteredProfile.privatehometown === 'private') filteredProfile.hometown = undefined;
      if (filteredProfile.privatebirthday === 'private') filteredProfile.birthday = undefined;
      if (filteredProfile.privateSchool === 'private') { 
        filteredProfile.school = undefined;
        filteredProfile.graduated = undefined;
      }

      res.json({ success: true, profile: filteredProfile });
    } else {
      // Nếu không truyền userId (hoặc truyền userId chính mình), load đủ thông tin
      profile = await profileModel.findOne({ user: currentUserId });
      if (!profile) {
        return res.json({ success: true, profile: {} });
      }
      res.json({ success: true, profile });
    }

  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}


export const changeEmailContact = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.user.id;
    console.log("CONTACT : ", email, "ID: ", userId)

    const updatedProfile = await contactModel.findOneAndUpdate(
      { user: userId },
      {
        emailcontact: email,
      },
      { new: true, upsert: true }
    );
    console.log(updatedProfile)

    if (!updatedProfile) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy profile' });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật thành công',
      profile: updatedProfile
    });

  } catch (error) {
    console.log(error)
    res.status(401).json({ success: false, message: error });
  }
}

export const changePhoneContact = async (req, res) => {
  try {
    const { phone } = req.body;
    const userId = req.user.id;
    console.log("CONTACT PHONE: ", phone, "ID: ", userId)

    const updatedProfile = await contactModel.findOneAndUpdate(
      { user: userId },
      {
        phone: phone,
      },
      { new: true, upsert: true }
    );
    console.log(updatedProfile)

    if (!updatedProfile) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy profile' });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật thành công',
      profile: updatedProfile
    });

  } catch (error) {
    console.log(error)
    res.status(401).json({ success: false, message: error });
  }
}

export const changeWebsiteContact = async (req, res) => {
  try {
    const { website } = req.body;
    const userId = req.user.id;
    console.log("CONTACT WEBSITE: ", website, "ID: ", userId)

    const updatedProfile = await contactModel.findOneAndUpdate(
      { user: userId },
      {
        website: website,
      },
      { new: true, upsert: true }
    );
    console.log(updatedProfile)

    if (!updatedProfile) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy profile' });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật thành công',
      profile: updatedProfile
    });

  } catch (error) {
    console.log(error)
    res.status(401).json({ success: false, message: error });
  }
}

export const getContact = async (req, res) => {
  try {
    const userId = req.body.userId ? req.body.userId : req.user.id;

    const contact = await contactModel.findOne(
      { user: userId },
      '-_id emailcontact phone website user'
    );

    res.status(200).json({
      success: true,
      contact: contact
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}


export const addEvent = async (req, res) => {
  try {
    const userId = req.user.id;

    const { event, date } = req.body;

    console.log(event, date)
    if (!event) {
      return res.status(400).json({ success: false, message: 'Tên sự kiện là bắt buộc' });
    }

    const newEvent = await eventModel.create({
      user: userId,
      name: event,
      datetime: date ? new Date(date) : null
    });

    res.status(200).json({
      success: true,
      message: 'Thêm sự kiện thành công',
      event: newEvent
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const userId = req.user.id;

    const { id, event, date } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Thiếu id sự kiện' });
    }

    const updatedEvent = await eventModel.findOneAndUpdate(
      { _id: id, user: userId },
      { name: event, datetime: date ? new Date(date) : null },
      { new: true }
    );

    if (!updatedEvent) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật sự kiện thành công',
      event: updatedEvent
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const userId = req.user.id;

    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Thiếu id sự kiện' });
    }

    const deletedEvent = await eventModel.findOneAndDelete({ _id: id, user: userId });

    if (!deletedEvent) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện để xóa' });
    }

    res.status(200).json({
      success: true,
      message: 'Xóa sự kiện thành công'
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const getEvent = async (req, res) => {
  try {
    const userId = req.body.userId ? req.body.userId : req.user.id;

    // Lấy danh sách sự kiện không bao gồm user và _id
    const events = await eventModel.find({ user: userId }, { user: 0 }).sort({ datetime: 1 });

    res.status(200).json({
      success: true,
      events
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

