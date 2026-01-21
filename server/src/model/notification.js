const mongoose = require("mongoose");
const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    user: { 
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    from: { 
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "react",
        "comment",
        "friendRequest",
        "acceptFriend",
        "share",
      ],
      required: true,
    },
    reactType: {
      type: String,
      enum: ["like", "love", "fun", "sad", "angry"],
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
    }, 
    group: {
      type: Schema.Types.ObjectId,
      ref: "Group",
    }, 
    seen: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true, 
  }
);

notificationSchema.index({ user: 1, seen: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);

