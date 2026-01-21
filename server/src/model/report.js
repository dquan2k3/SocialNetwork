const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    type: { 
        type: String, 
        enum: ['user', 'message'], 
        required: true 
    },
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'conversations',
        required: function() {
            return this.type === 'message';
        },
    },
    reportedUser: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'accounts',
    },
    reporter: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'accounts',
        required: true 
    },
    reason: { 
        type: String, 
    },
    description: { 
        type: String 
    },
    status: {
        type: String,
        enum: ['pending', 'resolved', 'rejected'],
        default: 'pending'
    },
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'accounts',
    }
}, { timestamps: true });

export const reportModel = mongoose.model('reports', reportSchema);