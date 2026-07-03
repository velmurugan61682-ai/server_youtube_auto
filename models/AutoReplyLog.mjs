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
    required: false
  },
  replyText: {
    type: String,
    required: false
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'success'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

autoReplyLogSchema.index({ commentId: 1 }, { unique: true });
autoReplyLogSchema.index({ userId: 1 });

export default mongoose.model('AutoReplyLog', autoReplyLogSchema);
