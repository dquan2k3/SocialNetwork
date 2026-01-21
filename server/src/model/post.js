const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'accounts',
    required: true
  },
  text: String,
  privacy: String,
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'groups',
    default: null // Nếu null thì là bài viết cá nhân/chung
  }
}, { timestamps: true });

export const postModel = mongoose.model('posts', postSchema);

const postFileSchema = new mongoose.Schema({
  post_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'posts',
    required: true
  },
  file_url: String,
  file_type: String,
  order_index: Number,
});

export const postFileModel = mongoose.model('post_files', postFileSchema);

// Bảng react cho các bài post
const postReactSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'posts',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'accounts',
    required: true
  },
  react: {
    type: String,
    enum: ["like", "love", "fun", "sad", "angry"], 
    required: true
  }
}, { timestamps: false });

export const postReactModel = mongoose.model('post_reacts', postReactSchema);

// Bảng comment cho các bài post
const postCommentSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'posts',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'accounts',
    required: true
  },
  text: {
    type: String,
    required: true
  },
}, { timestamps: true });

export const postCommentModel = mongoose.model('post_comments', postCommentSchema);

// Bảng share cho các bài post (chỉ cần userId và postId)
const postShareSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'accounts',
    required: true
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'posts',
    required: true
  }
}, { timestamps: true });

export const postShareModel = mongoose.model('post_shares', postShareSchema);

// Bảng reported cho các post bị báo cáo
const postReportedSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'posts',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'accounts',
    required: true
  }
}, { timestamps: true });

export const postReportedModel = mongoose.model('post_reporteds', postReportedSchema);

// Bảng reported cho các comment bị báo cáo
const commentReportedSchema = new mongoose.Schema({
  commentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'post_comments',
    required: true
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'posts',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'accounts',
    required: true
  }
}, { timestamps: true });

export const commentReportedModel = mongoose.model('comment_reporteds', commentReportedSchema);
