import { accountModel } from "../model/auth";
import mongoose from "mongoose";
import {
  postModel,
  postCommentModel,
  postReportedModel,
  postShareModel,
  postFileModel,
  postReactModel,
  commentReportedModel,
} from "../model/post";
import { conversationModel, messageModel } from "../model/conversation";
import { reportModel } from "../model/report";
import { bioModel } from "../model/bio";
import { profileModel } from "../model/profile";

// Hàm load report post như trước
export const loadReportPost = async (req, res) => {
  // Lấy userId từ middleware xác thực (đính vào req.user)
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Không có userId, truy cập bị từ chối' });
  }
  try {
    // 1. Đếm số lần mỗi post bị báo cáo
    const reportCountsArr = await postReportedModel.aggregate([
      {
        $group: {
          _id: "$postId",
          reportCount: { $sum: 1 }
        }
      }
    ]);
    const postIdToCount = {};
    const reportedPostIds = reportCountsArr.map(r => {
      postIdToCount[r._id.toString()] = r.reportCount;
      return r._id;
    });

    if (!reportedPostIds || reportedPostIds.length === 0) {
      return res.json({ reportedPosts: [], message: "Không có bài nào bị báo cáo" });
    }

    // 2. Lấy text, user cho các bài post bị báo cáo
    const posts = await postModel.find(
      { _id: { $in: reportedPostIds } },
      { _id: 1, text: 1, user: 1 }
    ).lean();

    const userIds = [...new Set(posts.map(p => String(p.user)))];

    // 3. Lấy avatar, avatarCroppedArea cho user (tham chiếu chuẩn với bio.js context)
    const bios = await bioModel.find(
      { userid: { $in: userIds } },
      'userid avatar avatarCroppedArea'
    ).lean();
    const userIdToBio = {};
    for (const bio of bios) {
      userIdToBio[String(bio.userid)] = {
        avatar: bio.avatar,
        avatarCroppedArea: bio.avatarCroppedArea
      };
    }

    // 4. Lấy username, name cho user từ profile
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

    // 5. Ghép data gồm reportCount, text, postId, userId, avatar, avatarCroppedArea, username, name
    const result = posts.map(post => {
      const postIdStr = post._id.toString();
      const userIdStr = String(post.user);
      return {
        _id: postIdStr,
        postId: postIdStr,
        text: post.text,
        reportCount: postIdToCount[postIdStr] || 0,
        userId: userIdStr,
        avatar: userIdToBio[userIdStr]?.avatar ?? null,
        avatarCroppedArea: userIdToBio[userIdStr]?.avatarCroppedArea ?? null,
        username: userIdToProfile[userIdStr]?.username ?? null,
        name: userIdToProfile[userIdStr]?.name ?? null
      };
    });

    res.json({
      reportedPosts: result,
      message: "Danh sách các bài post bị báo cáo"
    });
  } catch (err) {
    console.error("Error in loadReportPost:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Hàm load report user (chỉ lấy report type = "user")
export const loadUserReports = async (req, res) => {
  try {
    // Lấy các report có type = 'user'
    const reports = await reportModel.find({ type: 'user' }).sort({ createdAt: -1 }).lean();

    // Lấy danh sách reportedUser (user bị báo cáo)
    const reportedUserIds = [
      ...new Set(reports
        .filter(r => r.reportedUser)
        .map(r => String(r.reportedUser)))
    ];

    // Lấy avatar, avatarCroppedArea, cover, coverCroppedArea từ bio
    const bios = await bioModel.find(
      { userid: { $in: reportedUserIds } },
      'userid avatar avatarCroppedArea cover coverCroppedArea'
    ).lean();
    const userIdToBio = {};
    for (const bio of bios) {
      userIdToBio[String(bio.userid)] = {
        avatar: bio.avatar,
        avatarCroppedArea: bio.avatarCroppedArea,
        cover: bio.cover ?? null,
        coverCroppedArea: bio.coverCroppedArea ?? null
      };
    }

    // Lấy username, name từ profile
    const profiles = await profileModel.find(
      { user: { $in: reportedUserIds } },
      'user username name'
    ).lean();
    const userIdToProfile = {};
    for (const profile of profiles) {
      userIdToProfile[String(profile.user)] = {
        username: profile.username,
        name: profile.name
      };
    }

    // Gắn thêm user info vào từng report nếu có reportedUser
    const reportsWithUserInfo = reports.map(report => {
      const reportedUserStr = report.reportedUser ? String(report.reportedUser) : null;
      return {
        ...report,
        userId: reportedUserStr,
        avatar: reportedUserStr ? (userIdToBio[reportedUserStr]?.avatar ?? null) : null,
        avatarCroppedArea: reportedUserStr ? (userIdToBio[reportedUserStr]?.avatarCroppedArea ?? null) : null,
        cover: reportedUserStr ? (userIdToBio[reportedUserStr]?.cover ?? null) : null,
        coverCroppedArea: reportedUserStr ? (userIdToBio[reportedUserStr]?.coverCroppedArea ?? null) : null,
        username: reportedUserStr ? (userIdToProfile[reportedUserStr]?.username ?? null) : null,
        name: reportedUserStr ? (userIdToProfile[reportedUserStr]?.name ?? null) : null,
      }
    });

    res.status(200).json({ success: true, reports: reportsWithUserInfo });
  } catch (err) {
    res.status(500).json({ message: "Có lỗi khi tải danh sách báo cáo.", error: err?.message || err });
  }
};

// POST /management/banUserDueToProfile
export const banUserDueToProfile = async (req, res) => {
  try {
    const {
      userId,
      banDays,
      isDelAvatar,
      isDelCover,
      isDelName,
      isDelUsername
    } = req.body;
    // phản hồi lỗi nếu thiếu userId
    if (!userId) {
      return res.status(400).json({ success: false, message: "Thiếu userId" });
    }

    // 1. Ban user nếu truyền vào banDays (khác null và khác undefined), nếu không thì bỏ qua ban
    if (typeof banDays !== "undefined" && banDays !== null && Number(banDays) > 0) {
      const banUntil = new Date();
      banUntil.setDate(banUntil.getDate() + Number(banDays));
      // xây dựng lý do vi phạm dựa trên các trường isDel* true
      const reasons = [];
      if (isDelAvatar) reasons.push('avatar');
      if (isDelCover) reasons.push('cover');
      if (isDelName) reasons.push('name');
      if (isDelUsername) reasons.push('username');
      let banReason = "Trang cá nhân vi phạm";
      if (reasons.length > 0) {
        banReason += ": " + reasons.join(', ');
      }
      await accountModel.findByIdAndUpdate(userId, {
        $set: {
          banUntil: banUntil,
          status: "banned",
          banReason: banReason
        }
      });
    }

    // Xoá/đổi thuộc tính trong bio
    if (isDelAvatar || isDelCover) {
      // lấy bio
      const userBio = await bioModel.findOne({ userid: userId });
      if (userBio) {
        if (isDelAvatar) {
          userBio.avatar = null;
          userBio.avatarCroppedArea = null;
        }
        if (isDelCover) {
          userBio.cover = null;
          userBio.coverCroppedArea = null;
        }
        await userBio.save();
      }
    }

    // Xoá/đổi name, username trong profile
    if (isDelName || isDelUsername) {
      const userProfile = await profileModel.findOne({ user: userId });
      if (!userProfile) {
        return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ người dùng" });
      }

      if (isDelName) {
        // Tạo tên mới: 'Hãy đổi tên xxx'
        const randomNum = () => Math.floor(Math.random() * 900 + 100); // 3 số
        userProfile.name = `Hãy đổi tên ${randomNum()}`;
      }

      if (isDelUsername) {
        let baseUsername = "username";
        let found = false;
        let newUsername = "";
        let tries = 0;
        const maxTries = 15;
        do {
          // 4 số ngẫu nhiên
          const randNum = Math.floor(Math.random() * 9000 + 1000);
          newUsername = `${baseUsername}${randNum}`;
          // Kiểm tra trùng với user khác
          const existingProfile = await profileModel.findOne({ username: newUsername });
          if (!existingProfile || existingProfile.user.toString() === userId) {
            found = true;
          } else {
            tries++;
          }
        } while (!found && tries < maxTries);

        if (!found) {
          // fallback random tên nếu lặp lại nhiều quá
          newUsername = `username${Math.floor(Math.random() * 100000)}`;
        }
        userProfile.username = newUsername;
      }

      await userProfile.save();
    }

    // Xóa tất cả các báo cáo type = 'user' về userId này
    await reportModel.deleteMany({ type: 'user', reportedUser: userId });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || err });
  }
};


// Hàm load report message (chỉ lấy các report type = "message")
// Nếu là tin nhắn nhóm (report có conversationId), lấy avatar và name từ conversationModel, không lấy avatar crop; nếu là user thì như cũ
export const loadReportMessage = async (req, res) => {
  try {
    // Lấy danh sách report type = 'message'
    const reports = await reportModel.find({ type: 'message' }).sort({ createdAt: -1 }).lean();

    // Lấy danh sách reportedUser (người dùng bị báo cáo)
    const reportedUserIds = [
      ...new Set(
        reports.filter(r => !!r.reportedUser).map(r => String(r.reportedUser))
      )
    ];

    // Lấy danh sách conversationId của các báo cáo tin nhắn nhóm (tức là report không có reportedUser mà có conversationId)
    const groupConversationIds = [
      ...new Set(
        reports
          .filter(r => !r.reportedUser && r.conversationId)
          .map(r => String(r.conversationId))
      )
    ];

    // Lấy avatar, avatarCroppedArea từ bio cho user
    const bios = await bioModel.find(
      { userid: { $in: reportedUserIds } },
      'userid avatar avatarCroppedArea'
    ).lean();
    const userIdToBio = {};
    for (const bio of bios) {
      userIdToBio[String(bio.userid)] = {
        avatar: bio.avatar,
        avatarCroppedArea: bio.avatarCroppedArea,
      };
    }

    // Lấy username, name từ profile cho user
    const profiles = await profileModel.find(
      { user: { $in: reportedUserIds } },
      'user username name'
    ).lean();
    const userIdToProfile = {};
    for (const profile of profiles) {
      userIdToProfile[String(profile.user)] = {
        username: profile.username,
        name: profile.name,
      };
    }

    // Lấy group avatar và group name từ conversationModel
    let conversationIdToGroup = {};
    if (groupConversationIds.length > 0) {
      // model đã được import phía trên (conversationModel)
      const groupConversations = await conversationModel.find(
        { _id: { $in: groupConversationIds } },
        { _id: 1, groupAvatar: 1, groupName: 1 }
      ).lean();
      // Dùng object để tra cứu nhanh
      for (const group of groupConversations) {
        conversationIdToGroup[String(group._id)] = {
          groupAvatar: group.groupAvatar ?? null,
          groupName: group.groupName ?? null,
        };
      }
    }

    // Gắn thêm info vào từng report
    const reportsWithInfo = reports.map(report => {
      // Nếu report là báo cáo user (có reportedUser)
      if (report.reportedUser) {
        const reportedUserStr = String(report.reportedUser);
        return {
          ...report,
          type: "message",
          userId: reportedUserStr,
          avatar: userIdToBio[reportedUserStr]?.avatar ?? null,
          avatarCroppedArea: userIdToBio[reportedUserStr]?.avatarCroppedArea ?? null,
          username: userIdToProfile[reportedUserStr]?.username ?? null,
          name: userIdToProfile[reportedUserStr]?.name ?? null,
          groupAvatar: null,
          groupName: null,
        };
      }
      // Nếu là báo cáo group (tin nhắn nhóm, không có reportedUser, có conversationId)
      if (!report.reportedUser && report.conversationId) {
        const convIdStr = String(report.conversationId);
        return {
          ...report,
          type: "message",
          userId: null,
          avatar: conversationIdToGroup[convIdStr]?.groupAvatar ?? null,
          // Không cần avatarCroppedArea cho group
          avatarCroppedArea: null,
          username: null,
          name: null,
          groupAvatar: conversationIdToGroup[convIdStr]?.groupAvatar ?? null,
          groupName: conversationIdToGroup[convIdStr]?.groupName ?? null,
        };
      }
      // Nếu không phải 2 loại trên, trả object như cũ
      return { ...report };
    });

    res.status(200).json({ success: true, reports: reportsWithInfo });
  } catch (err) {
    res.status(500).json({ message: "Có lỗi khi tải danh sách báo cáo message.", error: err?.message || err });
  }
};


// Lấy danh sách các message bị báo cáo trong một conversation (hoặc theo user, hỗ trợ tìm quanh reportTime)
// Nếu có userId thì sẽ lấy tin nhắn của user đó tại conversationId này (trong 24h quanh reportTime) 
// và tất cả các tin nhắn của user trên hệ thống (tại mọi conversation, trong 24h quanh reportTime)
export const loadReportedMessage = async (req, res) => {
  try {
    const { conversationId, userId, reportTime } = req.query;
    console.log('loadReportedMessage called with', { conversationId, userId, reportTime });

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId is required" });
    }
    if (!reportTime) {
      return res.status(400).json({ error: "reportTime is required" });
    }

    // Validate reportTime and convert to Date
    let reportDate;
    if (!isNaN(Number(reportTime))) {
      reportDate = new Date(Number(reportTime));
    } else {
      reportDate = new Date(reportTime);
    }

    // Check for invalid date
    if (isNaN(reportDate.getTime())) {
      return res.status(400).json({ error: "reportTime is not a valid date" });
    }

    // Tính window 24 giờ trước và sau reportTime
    let from = new Date(reportDate);
    let to = new Date(reportDate);
    from.setHours(from.getHours() - 24);
    to.setHours(to.getHours() + 24);

    let messages = [];

    if (userId) {
      // 1. Tin nhắn của userId tại conversationId này, trong 24h quanh reportTime
      const messagesInConversation = await messageModel.find({
        conversationId: conversationId,
        sender: userId,
        createdAt: { $gte: from, $lte: to }
      })
        .sort({ createdAt: 1 })
        .select('sender text createdAt attachments readBy')
        .lean();

      // 2. Tất cả tin nhắn của userId trên toàn hệ thống, trong 24h quanh reportTime
      // (không chỉ trong conversationId này)
      const messagesOfUserAllConversations = await messageModel.find({
        sender: userId,
        createdAt: { $gte: from, $lte: to }
      })
        .sort({ createdAt: 1 })
        .select('sender text createdAt attachments readBy conversationId')
        .lean();

      // Kết hợp và loại bỏ trùng lặp (_id)
      const messagesMap = new Map();
      for (let msg of [...messagesInConversation, ...messagesOfUserAllConversations]) {
        messagesMap.set(String(msg._id), msg);
      }
      messages = Array.from(messagesMap.values());
      // Sắp xếp lại theo createdAt tăng dần
      messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      // Giới hạn 100 tin nhắn gần reportTime nhất
      if (messages.length > 100) {
        messages = messages.slice(0, 100);
      }

    } else {
      // Không có userId, chỉ lấy tất cả tin nhắn trong conversation trong khoảng thời gian 24h quanh reportTime
      messages = await messageModel.find({
        conversationId: conversationId,
        createdAt: { $gte: from, $lte: to },
      })
        .sort({ createdAt: 1 })
        .limit(100)
        .select('sender text createdAt attachments readBy')
        .lean();
    }

    // Định dạng lại như loadMessage ở conversation.js
    const formattedMessages = messages.map(msg => ({
      id: msg._id.toString(),
      senderId: msg.sender,
      message: msg.text,
      conversationId: msg.conversationId ? msg.conversationId.toString() : undefined,
      createdAt: msg.createdAt,
      attachments: msg.attachments || [],
      readBy: msg.readBy || [],
    }));

    return res.status(200).json({ messages: formattedMessages });
  } catch (error) {
    console.error("Error in loadReportedMessage:", error);
    res.status(500).json({ error: error && error.message ? error.message : String(error) });
  }
};


// Hàm giải tán nhóm chat (xóa group conversation) và xóa tất cả tin nhắn nhóm đó
export const removeRoomChat = async (req, res) => {
  try {
    const { conversationId } = req.body;
    if (!conversationId) {
      return res.status(400).json({ success: false, message: "Thiếu conversationId." });
    }

    // Kiểm tra conversation có phải là nhóm hay không
    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) {
      // Không thấy nhóm, vẫn xóa tất cả các report liên quan tới nhóm chat này
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

    await conversationModel.findByIdAndDelete(conversationId);

    const deleteResult = await messageModel.deleteMany({ conversationId });

    const deleteReportResult = await reportModel.deleteMany({ type: "message", conversationId: conversationId });

    return res.status(200).json({
      success: true,
      message: "Đã giải tán nhóm chat và xóa tất cả tin nhắn nhóm.",
      deletedMessages: deleteResult.deletedCount,
      deletedReports: deleteReportResult.deletedCount
    });
  } catch (error) {
    console.error("Lỗi khi giải tán nhóm chat:", error);
    return res.status(500).json({
      success: false,
      message: error && error.message ? error.message : String(error),
    });
  }
};

// Xóa một report theo reportId
export const deleteReport = async (req, res) => {
  try {
    const { reportId } = req.body || req.query || req.params;
    if (!reportId) {
      return res.status(400).json({ success: false, message: "Thiếu reportId." });
    }
    const deleted = await reportModel.findByIdAndDelete(reportId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Không tìm thấy report để xóa." });
    }
    res.json({ success: true, message: "Xóa report thành công!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi khi xóa report.", error: err?.message || err });
  }
};

// Hàm load report comment  
export const loadReportComment = async (req, res) => {
  // Lấy userId từ middleware xác thực (đính vào req.user)
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Không có userId, truy cập bị từ chối' });
  }
  try {
    // 1. Đếm số lần mỗi comment bị báo cáo
    const reportCountsArr = await commentReportedModel.aggregate([
      {
        $group: {
          _id: "$commentId",
          reportCount: { $sum: 1 }
        }
      }
    ]);
    const commentIdToCount = {};
    const reportedCommentIds = reportCountsArr.map(r => {
      commentIdToCount[r._id.toString()] = r.reportCount;
      return r._id;
    });

    if (!reportedCommentIds || reportedCommentIds.length === 0) {
      return res.json({ reportedComments: [], message: "Không có bình luận nào bị báo cáo" });
    }

    // 2. Lấy text, user, post của các comment bị báo cáo
    // Chú ý: Lấy trường text, user, post đúng như schema postCommentSchema
    const comments = await postCommentModel.find(
      { _id: { $in: reportedCommentIds } },
      { _id: 1, text: 1, user: 1, post: 1 }
    ).lean();

    const userIds = [...new Set(comments.map(c => String(c.user)))];

    // 3. Lấy avatar, avatarCroppedArea cho user (bio)
    const bios = await bioModel.find(
      { userid: { $in: userIds } },
      'userid avatar avatarCroppedArea'
    ).lean();
    const userIdToBio = {};
    for (const bio of bios) {
      userIdToBio[String(bio.userid)] = {
        avatar: bio.avatar,
        avatarCroppedArea: bio.avatarCroppedArea
      };
    }

    // 4. Lấy username, name cho user từ profile
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

    // 5. Ghép data gồm reportCount, text (nội dung comment), commentId, userId, avatar, avatarCroppedArea, username, name, postId
    const result = comments.map(comment => {
      const commentIdStr = comment._id.toString();
      const userIdStr = String(comment.user);
      return {
        _id: commentIdStr,
        commentId: commentIdStr,
        text: comment.text, // text của comment
        postId: String(comment.post), // khóa tham chiếu bài post gốc
        reportCount: commentIdToCount[commentIdStr] || 0,
        userId: userIdStr,
        avatar: userIdToBio[userIdStr]?.avatar ?? null,
        avatarCroppedArea: userIdToBio[userIdStr]?.avatarCroppedArea ?? null,
        username: userIdToProfile[userIdStr]?.username ?? null,
        name: userIdToProfile[userIdStr]?.name ?? null
      };
    });

    res.json({
      reportedComments: result,
      message: "Danh sách các bình luận bị báo cáo"
    });
  } catch (err) {
    console.error("Error in loadReportComment:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Hàm tìm kiếm report post: Tìm kiếm theo tên người đăng (name/username) hoặc text trong bài post
export const searchReportPost = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Không có userId, truy cập bị từ chối' });
  }
  try {
    const { search } = req.query;
    const searchRegex = search ? new RegExp(search, "i") : null;

    // 1. Đếm số lần mỗi post bị báo cáo
    const reportCountsArr = await postReportedModel.aggregate([
      {
        $group: {
          _id: "$postId",
          reportCount: { $sum: 1 }
        }
      }
    ]);
    const postIdToCount = {};
    const reportedPostIds = reportCountsArr.map(r => {
      postIdToCount[r._id.toString()] = r.reportCount;
      return r._id;
    });

    if (!reportedPostIds || reportedPostIds.length === 0) {
      return res.json({ reportedPosts: [], message: "Không có bài nào bị báo cáo" });
    }

    // 2. Lấy text, user cho các bài post bị báo cáo
    let posts = await postModel.find(
      { _id: { $in: reportedPostIds } },
      { _id: 1, text: 1, user: 1 }
    ).lean();

    const userIds = [...new Set(posts.map(p => String(p.user)))];

    // 3. Lấy avatar, avatarCroppedArea cho user (tham chiếu chuẩn với bio.js context)
    const bios = await bioModel.find(
      { userid: { $in: userIds } },
      'userid avatar avatarCroppedArea'
    ).lean();
    const userIdToBio = {};
    for (const bio of bios) {
      userIdToBio[String(bio.userid)] = {
        avatar: bio.avatar,
        avatarCroppedArea: bio.avatarCroppedArea
      };
    }

    // 4. Lấy username, name cho user từ profile
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

    // 5. Ghép data gồm reportCount, text, postId, userId, avatar, avatarCroppedArea, username, name
    let result = posts.map(post => {
      const postIdStr = post._id.toString();
      const userIdStr = String(post.user);
      return {
        _id: postIdStr,
        postId: postIdStr,
        text: post.text,
        reportCount: postIdToCount[postIdStr] || 0,
        userId: userIdStr,
        avatar: userIdToBio[userIdStr]?.avatar ?? null,
        avatarCroppedArea: userIdToBio[userIdStr]?.avatarCroppedArea ?? null,
        username: userIdToProfile[userIdStr]?.username ?? null,
        name: userIdToProfile[userIdStr]?.name ?? null
      };
    });

    // 6. Lọc theo search - trên text hoặc name hoặc username (không phân biệt hoa thường)
    if (searchRegex) {
      result = result.filter(r =>
        (r.text && searchRegex.test(r.text)) ||
        (r.name && searchRegex.test(r.name)) ||
        (r.username && searchRegex.test(r.username))
      );
    }

    res.json({
      reportedPosts: result,
      message: "Danh sách các bài post bị báo cáo (theo tìm kiếm, full avatar crop info)"
    });
  } catch (err) {
    console.error("Error in searchReportPost:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Dựa theo auth.js (file_context_0): Email, Password, Role, status ('active', 'banned'), banUntil ----
// Chỉnh truy vấn accountModel, trả các trường đúng với lược đồ, tránh để lộ Password

export const loadUser = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Không có userId, truy cập bị từ chối' });
  }

  try {
    let { cursor, keyword, priority } = req.query;
    priority = typeof priority === "string" ? priority.toLowerCase() : undefined;
    const PAGE_SIZE = 10;

    // Sắp xếp các điều kiện truy vấn để không loại bỏ các user có status/emails/banUntil là các giá trị null, undefined hoặc rỗng

    const getPriority = (user) => {
      if ((user.Role || '').toLowerCase() === 'admin') return 0;
      if ((user.status || '').toLowerCase() === 'banned') return 1;
      return 2;
    };

    let mainFilter;
    if (priority === "user") {
      // Chỉ lấy thường dân (không phải admin),
      // loại trừ chỉ những user có status === "banned" (tức: nhận cả undefined, "", null, "active", ... trừ duy nhất 'banned')
      mainFilter = {
        $and: [
          {
            $or: [
              { Role: { $exists: false } },
              { Role: { $not: { $regex: /^admin$/i } } }
            ]
          },
          {
            $or: [
              { status: { $exists: false } },
              { status: null },
              { status: "" },
              { status: { $not: { $regex: /^banned$/i } } }
            ]
          }
        ]
      };
    } else if (priority === "banned") {
      // Chỉ lấy những user bị ban (không phải admin)
      // Nhận luôn user có status === 'banned', bất kể banUntil là null hay không
      mainFilter = {
        $and: [
          {
            $or: [
              { Role: { $exists: false } },
              { Role: { $not: { $regex: /^admin$/i } } }
            ]
          },
          { status: { $regex: /^banned$/i } }
        ]
      };
    } else {
      // Mặc định: trả cả admin + user thường + banned
      mainFilter = {
        $or: [
          { Role: { $regex: /^admin$/i } },
          {
            $and: [
              {
                $or: [
                  { Role: { $exists: false } },
                  { Role: { $not: { $regex: /^admin$/i } } }
                ]
              },
              {
                $or: [
                  { status: { $exists: false } },
                  { status: null },
                  { status: "" },
                  { status: { $regex: /^banned$/i } },
                  { status: { $regex: /^active$/i } }
                ]
              }
            ]
          }
        ]
      };
    }

    // 2. Lấy ra candidate users từ account theo priority filter trước (có thể rất nhiều)
    let allUsers = await accountModel.find(mainFilter, { Password: 0 }).lean();

    // 3. Nếu có keyword: lọc những user _id thuộc các profile match
    let profileMap = {};
    let bioMap = {};
    let candidateUserIds = allUsers.map(u => u._id?.toString());

    if (keyword && keyword.trim() !== "") {
      // Lấy profile match
      const searchRegex = new RegExp(keyword.trim(), "i");
      const foundProfiles = await profileModel.find(
        {
          $or: [
            { name: searchRegex },
            { username: searchRegex }
          ],
          user: { $in: candidateUserIds }
        },
        { user: 1 }
      ).lean();

      const profileMatchUserIds = foundProfiles.map(p => p.user?.toString()).filter(Boolean);

      // Nếu không có userId nào match keyword sau khi áp dụng cả filter priority + profile, trả rỗng
      if (profileMatchUserIds.length === 0) {
        return res.json({ success: true, users: [], nextCursor: null, priority: priority ?? "admin" });
      }

      // Lọc allUsers bằng các user id còn lại sau khi match keyword trên profile thôi
      allUsers = allUsers.filter(u => profileMatchUserIds.includes(u._id.toString()));
      // Cập nhật candidateUserIds theo tập mới
      candidateUserIds = allUsers.map(u => u._id?.toString());
    }

    // Dán priority
    allUsers = allUsers
      .map(u => ({
        ...u,
        _priority: getPriority(u)
      }));

    // Sắp xếp đúng thứ tự priority, createdAt giảm dần
    allUsers = allUsers.sort((a, b) => {
      if (a._priority !== b._priority) return a._priority - b._priority;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // --- Xử lý cursor dựa trên (priority, createdAt) thực sự ---
    let usersPage;
    let nextCursor = null;

    if (cursor) {
      // cursor được truyền lên dạng {priority}-{createdAt}, ví dụ: "1-2024-05-17T21:15:21.999Z"
      let cursorPriority = null;
      let cursorDate = null;
      if (typeof cursor === "string" && cursor.includes('-')) {
        const [prStr, ...dateParts] = cursor.split('-');
        cursorPriority = parseInt(prStr, 10);
        cursorDate = new Date(dateParts.join('-'));
        if (isNaN(cursorPriority) || isNaN(cursorDate.getTime())) {
          cursorPriority = null;
          cursorDate = null;
        }
      }
      if (cursorPriority !== null && cursorDate) {
        allUsers = allUsers.filter(u => {
          if (u._priority > cursorPriority) return true;
          if (u._priority < cursorPriority) return false;
          return new Date(u.createdAt) < cursorDate;
        });
      }
    }

    usersPage = allUsers.slice(0, PAGE_SIZE);

    if (allUsers.length > PAGE_SIZE) {
      const last = usersPage[usersPage.length - 1];
      nextCursor = `${last._priority}-${new Date(last.createdAt).toISOString()}`;
    }

    const pageUserIds = usersPage.map((u) => u._id);

    // Lấy profile & bio chỉ của usersPage (giảm số lượng truy vấn)
    const profiles = await profileModel.find({ user: { $in: pageUserIds } }).lean();
    const bios = await bioModel.find({ userid: { $in: pageUserIds } }).lean();

    profiles.forEach((p) => { profileMap[p.user?.toString()] = p; });
    bios.forEach((b) => { bioMap[b.userid?.toString()] = b; });

    const usersWithDetails = usersPage.map((user) => {
      const id = user._id.toString();
      const profile = profileMap[id] || {};
      const bio = bioMap[id] || {};
      return {
        _id: user._id,
        userId: id,
        Email: user.Email ?? null,
        Role: user.Role ?? "User",
        status: user.status ?? "active",
        banUntil: typeof user.banUntil !== 'undefined' ? user.banUntil : null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        avatar: bio.avatar ?? null,
        avatarCroppedArea: bio.avatarCroppedArea ?? null,
        username: profile.username ?? null,
        name: profile.name ?? null
      };
    });

    // Đánh lại priority trả về cho phía client dựa trên kết quả thực tế
    let resultPriority = "admin";
    if (usersWithDetails.length > 0) {
      if (usersWithDetails.every(u => (u.status || '').toLowerCase() === 'banned' && (u.Role || '').toLowerCase() !== "admin")) {
        resultPriority = "banned";
      } else if (usersWithDetails.some(u => (u.Role || '').toLowerCase() !== 'admin' && (u.status || '').toLowerCase() !== 'banned')) {
        resultPriority = "user";
      }
    }

    res.json({
      success: true,
      users: usersWithDetails,
      nextCursor,
      priority: resultPriority
    });
  } catch (error) {
    console.error("Lỗi khi load user:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tải user",
      error: error && error.message ? error.message : String(error),
    });
  }
};


export const loadDashboard = async (req, res) => {
  // Get userId from veryfiToken (assumed to be attached to req.user by auth middleware)
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Không có userId, truy cập bị từ chối' });
  }

  // Lấy filter truyền lên, mặc định là 'week' nếu không truyền
  const { filter = 'week' } = req.query;

  // Helper để tính thời điểm bắt đầu theo filter
  function getDateRange(filterValue) {
    const now = new Date();
    switch (filterValue) {
      case 'day': {
        const dayAgo = new Date(now);
        dayAgo.setDate(now.getDate() - 1);
        return dayAgo;
      }
      case 'week': {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return weekAgo;
      }
      case 'month': {
        const monthAgo = new Date(now);
        monthAgo.setMonth(now.getMonth() - 1);
        return monthAgo;
      }
      case 'year': {
        const yearAgo = new Date(now);
        yearAgo.setFullYear(now.getFullYear() - 1);
        return yearAgo;
      }
      case 'all':
      default:
        return null; // Không giới hạn thời gian
    }
  }

  // Lấy mốc thời gian theo filter
  const fromDate = getDateRange(filter);

  // Tạo điều kiện query cho các collection liên quan đến thời gian
  const timeQuery = fromDate ? { createdAt: { $gte: fromDate } } : {};

  try {
    // Total user count không lọc theo thời gian (nếu muốn chỉ đếm user mới thì có thể cập nhật)
    // Nhưng thường tổng user sẽ lấy tất cả
    const userCount = await accountModel.countDocuments(timeQuery);

    // Tổng số bài viết theo filter
    const postCount = await postModel.countDocuments(timeQuery);

    // Tổng số comment theo filter
    const commentCount = await postCommentModel.countDocuments(timeQuery);

    // Tổng số báo cáo theo filter
    const reportedCount = await postReportedModel.countDocuments(timeQuery);

    res.json({
      success: true,
      userCount,
      postCount,
      commentCount,
      reportedCount,
    });
  } catch (error) {
    console.error("Lỗi khi load dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tải dashboard",
      error: error && error.message ? error.message : String(error),
    });
  }
};

/**
 * Controller: getRecentDashboard
 * Lấy 10 hoạt động (post, share) mới nhất và thống kê tổng số lượng reaction, comment, share cho từng post.
 * Không lọc postId như code cũ, chỉ lấy top 10 mới nhất (không cần lọc và tổng hợp id gốc như getRecentPosts).
 */
export const getRecentDashboard = async (req, res) => {
  // Lấy userId từ veryfiToken (assumed đã đính kèm ở req.user bởi auth middleware)
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Không có userId, truy cập bị từ chối' });
  }
  try {
    // Lọc theo cursor
    // Nếu có cursor, chỉ lấy những cái createdAt < cursor (tức là cũ hơn cursor)
    // cursor là ISO date string hoặc số milliseconds, prefer ISO date
    let { cursor } = req.query;
    let postQuery = {};
    let shareQuery = {};
    if (cursor) {
      let cursorDate;
      try {
        cursorDate = new Date(cursor);
        if (isNaN(cursorDate.getTime())) throw new Error();
      } catch (err) {
        return res.status(400).json({ success: false, message: 'Cursor không hợp lệ' });
      }
      postQuery = { createdAt: { $lt: cursorDate } };
      shareQuery = { createdAt: { $lt: cursorDate } };
    }

    // Lấy 10 bài post mới nhất (tính từ cursor hoặc bắt đầu)
    const postsPromise = postModel
      .find(postQuery)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    // Lấy 10 bài share mới nhất (tính từ cursor hoặc bắt đầu)
    const sharesPromise = postShareModel
      .find(shareQuery)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const [posts, shares] = await Promise.all([postsPromise, sharesPromise]);

    // Gộp lại theo đúng thứ tự mới nhất
    let activities = [];
    posts.forEach((post) => {
      activities.push({
        _id: post._id,
        user: post.user,
        text: post.text,
        privacy: post.privacy,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        type: "post",
        originalPostId: null,
      });
    });
    shares.forEach((share) => {
      activities.push({
        _id: share._id,
        user: share.user,
        text: undefined, // sẽ lấy từ post gốc ở dưới
        privacy: undefined,
        createdAt: share.createdAt,
        updatedAt: share.updatedAt || share.createdAt,
        type: "shared",
        originalPostId: share.post,
      });
    });

    // Sắp xếp lại theo thời gian mới nhất
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const activitiesTop = activities.slice(0, 10);

    // Nếu là share thì cần lấy thêm thông tin bài gốc
    let allPostMap = {};
    const allPostIds = [
      ...new Set(
        activitiesTop
          .filter((a) => a.type === "shared" && a.originalPostId)
          .map((a) => String(a.originalPostId))
      ),
    ];
    if (allPostIds.length > 0) {
      const postDocs = await postModel
        .find({
          _id: { $in: allPostIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
        .lean();
      for (const doc of postDocs) {
        allPostMap[String(doc._id)] = doc;
      }
    }

    // Dán text/privacy gốc cho các share
    activitiesTop.forEach((a) => {
      if (a.type === "shared") {
        const sharedPost = allPostMap[String(a.originalPostId)];
        if (sharedPost) {
          a.text = sharedPost.text;
          a.privacy = sharedPost.privacy;
        }
      }
    });

    // Gom tất cả các _id có trong list activitiesTop (gồm cả id của share object và id của post gốc)
    // Đếm reaction, comment, share cho TỪNG _id trong activitiesTop (tức là từng activity, không group về post gốc như getRecentPosts)
    const activityIds = activitiesTop.map((a) =>
      a.type === "shared"
        ? new mongoose.Types.ObjectId(a.originalPostId)
        : new mongoose.Types.ObjectId(a._id)
    );

    // Reaction
    const defaultReactCounts = {
      like: 0,
      love: 0,
      fun: 0,
      sad: 0,
      angry: 0,
    };
    const reactStats = await postReactModel.aggregate([
      { $match: { post: { $in: activityIds } } },
      {
        $group: {
          _id: { post: "$post", react: "$react" },
          count: { $sum: 1 },
        },
      },
    ]);
    const postIdToReactCounts = {};
    for (const a of activitiesTop) {
      const idStr =
        a.type === "shared" ? String(a.originalPostId) : String(a._id);
      postIdToReactCounts[idStr] = { ...defaultReactCounts };
    }
    reactStats.forEach((stat) => {
      const postId = String(stat._id.post);
      const react = stat._id.react;
      if (!postIdToReactCounts[postId])
        postIdToReactCounts[postId] = { ...defaultReactCounts };
      postIdToReactCounts[postId][react] = stat.count;
    });

    // Comment
    const commentStats = await postCommentModel.aggregate([
      { $match: { post: { $in: activityIds } } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]);
    const postIdToCommentCount = {};
    for (const a of activitiesTop) {
      const idStr =
        a.type === "shared" ? String(a.originalPostId) : String(a._id);
      postIdToCommentCount[idStr] = 0;
    }
    commentStats.forEach((stat) => {
      postIdToCommentCount[String(stat._id)] = stat.count;
    });

    // Share
    const shareStats = await postShareModel.aggregate([
      { $match: { post: { $in: activityIds } } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]);
    const postIdToShareCount = {};
    for (const a of activitiesTop) {
      const idStr =
        a.type === "shared" ? String(a.originalPostId) : String(a._id);
      postIdToShareCount[idStr] = 0;
    }
    shareStats.forEach((stat) => {
      postIdToShareCount[String(stat._id)] = stat.count;
    });

    // Lấy files cho từng activity (dựa trên id post thật)
    const fileIds = [
      ...new Set(
        activitiesTop.map((a) =>
          a.type === "shared" ? String(a.originalPostId) : String(a._id)
        )
      ),
    ];
    const files = await postFileModel
      .find({ post_id: { $in: fileIds.map((id) => new mongoose.Types.ObjectId(id)) } })
      .sort({ order_index: 1 })
      .lean();
    const postIdToFiles = {};
    for (const f of files) {
      const key = String(f.post_id);
      if (!postIdToFiles[key]) postIdToFiles[key] = [];
      postIdToFiles[key].push({
        file_url: f.file_url,
        file_type: f.file_type,
        order_index: f.order_index,
      });
    }

    // Lấy thông tin bio/profile các user liên quan (gồm user của post + nguời của post gốc nếu là share)
    const userIds = Array.from(
      new Set(
        activitiesTop
          .map((a) => String(a.user))
          .concat(
            activitiesTop
              .filter((a) => a.type === "shared")
              .map((a) => {
                const post = allPostMap[String(a.originalPostId)];
                return post ? String(post.user) : null;
              })
              .filter(Boolean)
          )
      )
    );

    const bios = await bioModel
      .find(
        { userid: { $in: userIds } },
        "userid avatar cover avatarCroppedArea coverCroppedArea"
      )
      .lean();
    const userIdToBio = {};
    for (const bio of bios) {
      userIdToBio[String(bio.userid)] = {
        avatar: bio.avatar,
        cover: bio.cover,
        avatarCroppedArea: bio.avatarCroppedArea,
        coverCroppedArea: bio.coverCroppedArea,
      };
    }
    const profiles = await profileModel
      .find({ user: { $in: userIds } }, "user username name")
      .lean();
    const userIdToProfile = {};
    for (const profile of profiles) {
      userIdToProfile[String(profile.user)] = {
        username: profile.username,
        name: profile.name,
      };
    }

    // Chuẩn output (không lọc id như getRecentPosts, từng activity dùng id riêng)
    const result = activitiesTop.map((a) => {
      const postIdStr =
        a.type === "shared" ? String(a.originalPostId) : String(a._id);
      const reactCount = postIdToReactCounts[postIdStr] || {
        ...defaultReactCounts,
      };
      const shareCount = postIdToShareCount[postIdStr] || 0;
      const commentCount = postIdToCommentCount[postIdStr] || 0;
      const sharedOriginPost =
        a.type === "shared" ? allPostMap[postIdStr] : null;

      return {
        _id: a._id,
        user: a.user,
        text: a.text,
        privacy: a.privacy,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        files: postIdToFiles[postIdStr] || [],
        reactCount,
        bioUser: userIdToBio[String(a.user)] || null,
        profileUser: userIdToProfile[String(a.user)] || null,
        shareCount,
        commentCount,
        type: a.type,
        originalPostId: a.type === "shared" ? String(a.originalPostId) : null,
        originalPostUser:
          a.type === "shared" && sharedOriginPost
            ? String(sharedOriginPost.user)
            : null,
        originalPostBio:
          a.type === "shared" && sharedOriginPost
            ? userIdToBio[String(sharedOriginPost.user)] || null
            : null,
        originalPostProfile:
          a.type === "shared" && sharedOriginPost
            ? userIdToProfile[String(sharedOriginPost.user)] || null
            : null,
      };
    });

    // Trả về thêm cursor mới cho client (cursor mới là createdAt nhỏ nhất vừa trả về)
    let nextCursor = null;
    if (result.length > 0) {
      const createdAts = result.map((a) => a.createdAt).filter(Boolean);
      // new Date(...).toISOString() để chuẩn
      if (createdAts.length > 0) {
        const minCreatedAt = createdAts.reduce((min, curr) => new Date(curr) < new Date(min) ? curr : min, createdAts[0]);
        nextCursor = new Date(minCreatedAt).toISOString(); // truyền lại cho client
      }
    }

    return res.status(200).json({ success: true, posts: result, nextCursor });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error?.message,
    });
  }
};


export const banUserAndRemovePost = async (req, res) => {
  const session = await postModel.startSession();
  session.startTransaction();
  try {
    const { postId, days } = req.body;
    if (!postId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Thiếu postId" });
    }

    // Tìm post cần remove
    const post = await postModel.findById(postId).session(session);
    if (!post) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Không tìm thấy bài viết cần xóa." });
    }

    // Lấy thông tin name người dùng trước khi xóa và ban (nếu có)
    const userId = post.user;
    const info = await profileModel.findOne(
      { user: userId },
      "name -_id"
    ).session(session);
    const name = info?.name || "Người dùng";

    let banResult = null;
    // Nếu days có giá trị và > 0 thì ban user trước khi xoá post
    if (typeof days !== "undefined" && Number(days) > 0) {
      const banUntil = new Date();
      banUntil.setDate(banUntil.getDate() + Number(days));
      banResult = await accountModel.findByIdAndUpdate(
        userId,
        { $set: { banUntil: banUntil, status: 'banned', banReason: "Đăng tải nội dung vi phạm." } },
        { new: true, session }
      );
      // Log thêm thông tin tài khoản sau khi bị ban
      console.log({
        status: banResult?.status,
        banUntil: banResult?.banUntil,
        banReason: banResult?.banReason,
        _id: banResult?._id,
        Email: banResult?.Email,
        Password: banResult?.Password,
        Role: banResult?.Role,
        createdAt: banResult?.createdAt,
        updatedAt: banResult?.updatedAt,
        __v: banResult?.__v,
      });
    }

    // Xóa post
    await postModel.findByIdAndDelete(postId, { session });

    await session.commitTransaction();
    session.endSession();

    if (banResult) {
      return res.status(200).json({
        success: true,
        message: `Xóa bài viết thành công. Đã cấm ${name} trong ${days} ngày.`,
        bannedUser: {
          _id: banResult._id,
          email: banResult.Email,
          banUntil: banResult.banUntil,
          banReason: banResult.banReason
        }
      });
    } else {
      return res.status(200).json({
        success: true,
        message: `Đã xóa bài viết của ${name} thành công.`,
      });
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(500).json({
      success: false,
      message: error && error.message ? error.message : String(error),
    });
  }
};


export const banUserDueToMessage = async (req, res) => {
  try {
    const { userId, banDays } = req.body;
    if (!userId || typeof banDays === "undefined" || banDays === null) {
      return res.status(400).json({ success: false, message: "Thiếu userId hoặc số ngày ban (banDays)" });
    }

    let user = null;

    if (Number(banDays) > 0) {
      const banUntil = new Date();
      banUntil.setDate(banUntil.getDate() + Number(banDays));
      user = await accountModel.findByIdAndUpdate(
        userId,
        { $set: { banUntil: banUntil, status: 'banned', banReason: "Gửi tin nhắn vi phạm." } },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ success: false, message: "Không tìm thấy user để cập nhật trạng thái." });
      }

      // Xóa các báo cáo message liên quan tới user này
      await reportModel.deleteMany({ type: "message", reportedUser: userId });

      return res.status(200).json({
        success: true,
        message: `Đã ban user trong ${banDays} ngày vì gửi tin nhắn vi phạm và đã xóa các báo cáo tin nhắn.`,
        user: {
          _id: user._id,
          email: user.Email,
          status: user.status,
          banUntil: user.banUntil,
          banReason: user.banReason ?? "",
        }
      });
    } else {
      // Nếu banDays = 0 thì hủy cấm (unban)
      user = await accountModel.findByIdAndUpdate(
        userId,
        { $set: { banUntil: null, status: "active", banReason: "" } },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ success: false, message: "Không tìm thấy user để cập nhật trạng thái." });
      }

      // Xóa các báo cáo message liên quan tới user này
      await reportModel.deleteMany({ type: "message", reportedUser: userId });

      return res.status(200).json({
        success: true,
        message: `Đã hủy cấm user và đã xóa các báo cáo tin nhắn.`,
        user: {
          _id: user._id,
          email: user.Email,
          status: user.status,
          banUntil: user.banUntil,
          banReason: user.banReason ?? "",
        }
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error && error.message ? error.message : String(error),
    });
  }
};



// Hàm để ban hoặc hủy cấm user (nếu banDays = 0 thì hủy cấm)
export const banUser = async (req, res) => {
  try {
    const { userId, banDays } = req.body;
    if (!userId || typeof banDays === "undefined" || banDays === null) {
      return res.status(400).json({ success: false, message: "Thiếu userId hoặc số ngày ban (banDays)" });
    }

    let user;

    if (Number(banDays) > 0) {
      const banUntil = new Date();
      banUntil.setDate(banUntil.getDate() + Number(banDays));
      // Sẽ không thay đổi banReason gì tại đây, chỉ cập nhật banUntil và status
      const update = { banUntil: banUntil, status: "banned" };

      user = await accountModel.findByIdAndUpdate(
        userId,
        { $set: update },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ success: false, message: "Không tìm thấy user để cập nhật trạng thái." });
      }

      return res.status(200).json({
        success: true,
        message: `Đã ban user trong ${banDays} ngày.`,
        user: {
          _id: user._id,
          email: user.Email,
          status: user.status,
          banUntil: user.banUntil,
          banReason: user.banReason ?? "",
        }
      });
    } else {
      // Nếu banDays = 0 thì hủy cấm (unban)
      // Sẽ không thay đổi banReason gì tại đây, chỉ cập nhật banUntil và status
      user = await accountModel.findByIdAndUpdate(
        userId,
        { $set: { banUntil: null, status: "active" } },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ success: false, message: "Không tìm thấy user để cập nhật trạng thái." });
      }

      return res.status(200).json({
        success: true,
        message: "Đã hủy cấm user thành công.",
        user: {
          _id: user._id,
          email: user.Email,
          status: user.status,
          banUntil: user.banUntil,
          banReason: user.banReason ?? "",
        }
      });
    }
  } catch (error) {
    console.error("Lỗi khi ban/hủy cấm user:", error);
    return res.status(500).json({
      success: false,
      message: error && error.message ? error.message : String(error),
    });
  }
};

// Hàm ban user với lý do, và đồng thời xóa report nếu có reportId
export const banUserWithReason = async (req, res) => {
  try {
    const { userId, banDays, reason, reportId } = req.body;

    if (
      !userId ||
      typeof banDays === "undefined" ||
      banDays === null ||
      !reason
    ) {
      return res.status(400).json({
        success: false,
        message: "Thiếu userId, số ngày ban (banDays) hoặc lý do.",
      });
    }

    if (typeof reason !== "string" || reason.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Lý do cấm không được để trống." });
    }
    if (reason.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Lý do cấm không được vượt quá 200 ký tự.",
      });
    }

    let user = null;
    if (Number(banDays) > 0) {
      const banUntil = new Date();
      banUntil.setDate(banUntil.getDate() + Number(banDays));
      const update = { banUntil, status: "banned", banReason: reason };
      user = await accountModel.findByIdAndUpdate(
        userId,
        { $set: update },
        { new: true }
      );
    } else {
      // số ngày bằng 0: không thay đổi trạng thái ban, banReason, chỉ xóa report nếu có
      user = await accountModel.findById(userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy user để cập nhật trạng thái.",
      });
    }

    let deletedReport = null;
    if (reportId) {
      const { reportModel } = require("../model/report");
      deletedReport = await reportModel.findByIdAndDelete(reportId);
    }

    return res.status(200).json({
      success: true,
      message:
        Number(banDays) > 0
          ? `Đã ban user trong ${banDays} ngày.`
          : "Không cập nhật trạng thái ban (banDays = 0).",
      user: {
        _id: user._id,
        email: user.Email,
        status: user.status,
        banUntil: user.banUntil,
        banReason: user.banReason ?? "",
      },
      ...(reportId && { deletedReport }),
    });
  } catch (error) {
    console.error("Lỗi khi ban/hủy ban user (có lý do):", error);
    return res.status(500).json({
      success: false,
      message: error && error.message ? error.message : String(error),
    });
  }
};

// Xóa tất cả bản ghi báo cáo bài viết (report post) dựa trên postId
export const removePostReport = async (req, res) => {
  try {
    const { postId } = req.body;
    if (!postId) {
      return res.status(400).json({ success: false, message: "Thiếu postId" });
    }

    // Xóa tất cả các bản ghi báo cáo liên quan đến bài post
    const delResult = await postReportedModel.deleteMany({ postId: postId });
    if (delResult.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy report để xóa." });
    }
    return res.status(200).json({ success: true, message: "Đã xóa report bài viết thành công.", deleted: delResult.deletedCount });
  } catch (error) {
    console.error("Lỗi khi xóa report bài viết:", error);
    return res.status(500).json({
      success: false,
      message: error && error.message ? error.message : String(error),
    });
  }
};

// Xóa một bản ghi báo cáo bình luận dựa trên commentId (report với comment)
export const removeCommentReport = async (req, res) => {
  try {
    const { commentId } = req.body;
    if (!commentId) {
      return res.status(400).json({ success: false, message: "Thiếu commentId" });
    }
    // Xóa tất cả các báo cáo của comment này
    const delResult = await commentReportedModel.deleteMany({ commentId });
    return res.status(200).json({ success: true, message: "Đã xóa report bình luận thành công.", deleted: delResult.deletedCount });
  } catch (error) {
    console.error("Lỗi khi xóa report bình luận:", error);
    return res.status(500).json({
      success: false,
      message: error && error.message ? error.message : String(error),
    });
  }
};

// Ban user liên quan bình luận và xóa tất cả các bình luận của user này đã bị báo cáo
export const banUserAndRemoveComment = async (req, res) => {
  try {
    const { commentId, days, userId } = req.body;

    if (
      !commentId ||
      typeof days === "undefined" ||
      days === null ||
      !userId
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Thiếu commentId, userId hoặc số ngày ban (days)"
        });
    }

    // Kiểm tra bình luận có tồn tại hay không
    const comment = await postCommentModel.findById(commentId);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bình luận." });
    }

    let update = {};
    if (Number(days) > 0) {
      const banUntil = new Date();
      banUntil.setDate(banUntil.getDate() + Number(days));
      update = {
        banUntil: banUntil,
        status: "banned",
        banReason: "Đăng tải bình luận vi phạm"
      };
    } else {
      update = { banUntil: null, status: "", banReason: "" };
    }
    await accountModel.findByIdAndUpdate(userId, { $set: update });

    const reportedComments = await commentReportedModel.find({ userId });

    const commentIdsToDelete = reportedComments.map(r => r.commentId);

    await postCommentModel.deleteMany({ _id: { $in: commentIdsToDelete } });

    await commentReportedModel.deleteMany({ commentId: { $in: commentIdsToDelete } });

    return res.status(200).json({
      success: true,
      message: `Đã ban user và xóa tất cả các bình luận bị báo cáo của user thành công.`,
      data: { userId, commentIdsDeleted: commentIdsToDelete }
    });
  } catch (error) {
    console.error("Lỗi khi ban user và xóa các bình luận đã bị báo cáo của user:", error);
    return res.status(500).json({
      success: false,
      message:
        error && error.message ? error.message : String(error),
    });
  }
};
