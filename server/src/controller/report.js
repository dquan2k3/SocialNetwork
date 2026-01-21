import { reportModel } from "../model/report";

// Tạo báo cáo mới
export const createReport = async (req, res) => {
  try {
    // Lấy myUserId từ verifyToken
    const myUserId = req.user?.id;

    const { userId, reason, type } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Thiếu userId, truy cập bị từ chối.' });
    }

    if (!reason || !type) {
      return res.status(400).json({ message: "Thiếu trường bắt buộc ." });
    }

    const newReport = await reportModel.create({
      type,
      reportedUser: userId,
      reporter: myUserId,
      reason,
      status: "pending",
    });

    res.status(201).json({ message: "Gửi báo cáo thành công.", report: newReport });
  } catch (err) {
    res.status(500).json({ message: "Có lỗi xảy ra khi gửi báo cáo.", error: err?.message || err });
  }
};

export const reportMessage = async (req, res) => {
  try {
    const myUserId = req.user?.id;
    const { userId, conversationId, type } = req.body;

    if (!type) {
      return res.status(400).json({ success: false, message: "Thiếu type." });
    }

    if (type === "message" && !conversationId) {
      return res.status(400).json({ success: false, message: "Thiếu conversationId." });
    }

    let reportData = {
      type,
      reporter: myUserId,
      status: "pending"
    };

    if (type === "message") {
      if (conversationId) reportData.conversationId = conversationId;
      if (userId) {
        reportData.reportedUser = userId;
      }
    }

    let duplicateCondition = {
      type,
      reporter: myUserId,
    };

    if (type === "message" && conversationId) {
      duplicateCondition.conversationId = conversationId;
    }
    if (reportData.reportedUser) {
      duplicateCondition.reportedUser = reportData.reportedUser;
    }

    const exist = await reportModel.findOne(duplicateCondition);

    if (exist) {
      return res.status(200).json({
        success: false,
        message: "Đã báo cáo về tin nhắn này rồi",
      });
    }

    const newReport = await reportModel.create(reportData);

    res.status(201).json({
      success: true,
      message: "Gửi báo cáo thành công.",
      report: newReport,
    });
  } catch (err) {
    console.log(err)
    res.status(500).json({
      success: false,
      message: "Có lỗi xảy ra khi gửi báo cáo.",
      error: err?.message || err,
    });
  }
};


// Xóa báo cáo (delete report)
export const deleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    if (!reportId) {
      return res.status(400).json({ message: "Thiếu id báo cáo để xóa." });
    }

    const deleted = await reportModel.findByIdAndDelete(reportId);

    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy báo cáo để xóa." });
    }

    res.status(200).json({ success: true, message: "Xóa báo cáo thành công." });
  } catch (err) {
    res.status(500).json({ message: "Có lỗi khi xóa báo cáo.", error: err?.message || err });
  }
};
