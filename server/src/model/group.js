const mongoose = require('mongoose');


const groupSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    cover: { type: String, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'accounts', required: true }
}, { timestamps: true });

const groupMemberSchema = new mongoose.Schema({
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'groups', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'accounts', required: true },
    role: {
        type: String,
        enum: ['owner', 'member'],
        default: 'member'
    },
    status: {
        type: String,
        enum: ['active', 'pending', 'banned'],
        default: 'pending'
    },
    bannedTill: { type: Date, default: null },
    message: { type: String, default: "" },
    joinedAt: { type: Date },
    requestedAt: { type: Date, default: Date.now }
});

const groupSettingSchema = new mongoose.Schema({
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'groups', required: true, unique: true },
    description: { type: String, default: "" },
    privacy: {
        type: String,
        enum: ['public', 'private', 'secret'],
        default: 'public'
    },
    requireApproval: { type: Boolean, default: false }
});

export const groupModel = mongoose.model('groups', groupSchema);
export const groupMemberModel = mongoose.model('groupmembers', groupMemberSchema);
export const groupSettingModel = mongoose.model('groupsettings', groupSettingSchema);
