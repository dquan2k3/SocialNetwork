const mongoose = require('mongoose');

const authSchema = new mongoose.Schema({
    Email: { type: String, required: true, unique: true },
    Password: { type: String, required: true },
    Role: { type: String, default: 'User' },
    status: { type: String, enum: ['active', 'banned'], default: 'active' },
    banUntil: { type: Date, default: null },
    banReason: { type: String, default: '' },
    lastSeen: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 }
  }, { timestamps: true });

authSchema.pre('save', async function (next) {
  if (!this.isNew) {
    // If Password changed, increment tokenVersion
    if (this.isModified('Password')) {
      this.tokenVersion = (this.tokenVersion || 0) + 1;
    }
  }
  next();
});

export const accountModel = mongoose.model('accounts', authSchema);