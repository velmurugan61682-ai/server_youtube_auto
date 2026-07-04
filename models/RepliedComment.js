import mongoose from 'mongoose';

const repliedCommentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  channelId: {
    type: String
  },
  videoId: {
    type: String,
    required: true,
    index: true
  },
  commentId: {
    type: String,
    required: true,
    unique: true
  },
  author: {
    type: String
  },
  commentText: {
    type: String
  },
  matchedKeyword: {
    type: String
  },
  replyText: {
    type: String
  },
  whatsappLink: {
    type: String
  },
  repliedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export default mongoose.model('RepliedComment', repliedCommentSchema);
