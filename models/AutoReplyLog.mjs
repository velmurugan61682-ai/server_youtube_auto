import mongoose from 'mongoose';

const autoReplyLogSchema = new mongoose.Schema({
  commentId: {
    type: String,
    required: true
  },
  videoId: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  detectedLanguage: {
    type: String,
    required: true
  },
  replyText: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

autoReplyLogSchema.index({ commentId: 1 });
autoReplyLogSchema.index({ userId: 1 });

export default mongoose.model('AutoReplyLog', autoReplyLogSchema);
