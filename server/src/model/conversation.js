const mongoose = require('mongoose');

const conversationMemberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'accounts', required: true },
  lastRead: { type: Date, default: null },
  lastReadMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'messages', default: null },
  joinedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'active'],
    default: 'pending'
  }
});

const conversationSchema = new mongoose.Schema({
  type: { type: String, enum: ['private', 'group'], required: true },
  members: { 
    type: [conversationMemberSchema], 
    required: true, 
    validate: { 
      validator: function(v) { return Array.isArray(v) && v.length > 0; }, 
      message: 'Conversation must have at least one member' 
    } 
  },
  owner: { // Thêm trường owner (chủ sở hữu cuộc trò chuyện)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'accounts',
    required: function() { return this.type === 'group'; },
    default: null
  },
  groupAvatar: { // Thêm avatar cho nhóm chat
    type: String,
    default: null
  },
  groupName: { // Tuỳ chọn: để lưu tên nhóm
    type: String,
    default: null
  },
  requireApproval: { 
    type: Boolean, 
    default: false 
  }
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'conversations', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'accounts', required: true },
  text: { type: String },
  attachments: { type: Array },
}, { timestamps: true });

// Notification Settings Model
const notificationSettingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'accounts', required: true },
  messagePriority: {
    type: String,
    enum: ['none', 'low', 'high'],
    default: 'high',
    required: true
  },
  groupMessagePriority: {
    type: String,
    enum: ['none', 'low', 'high'],
    default: 'high',
    required: true
  }
}, { timestamps: true });

// SelfChat Model
const selfChatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'accounts', required: true },
  messages: [{
    text: { type: String, required: true },
    type: { type: String, enum: ['self', 'bot'], required: true },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export const conversationModel = mongoose.model('conversations', conversationSchema);
export const messageModel = mongoose.model('messages', messageSchema);
export const notificationSettingModel = mongoose.model('notification_settings', notificationSettingSchema);
export const selfChatModel = mongoose.model('selfchats', selfChatSchema);

