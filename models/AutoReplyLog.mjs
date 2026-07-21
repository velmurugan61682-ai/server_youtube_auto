import mongoose from 'mongoose';

const autoReplyLogSchema = new mongoose.Schema({
  commentId: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null
  },
  channelId: {
    type: String,
    required: true
  },
  videoId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  commentText: {
    type: String,
    required: true
  },
  triggerKeyword: {
    type: String
  },
  replyText: {
    type: String
  },
  aiReply: {
    type: String // alias of replyText
  },
  deepseekResponse: {
    type: String
  },
  youtubeReplyId: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'success'
  },
  replyType: {
    type: String,
    default: 'Text'
  },
  carouselCards: [{
    imageUrl: { type: String, default: '' },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    btnLabel: { type: String, default: 'View Detail' },
    link: { type: String, default: '' },
    buttonText: { type: String, default: 'View Detail' },
    buttonUrl: { type: String, default: '' }
  }],
  failureReason: {
    type: String
  }
}, {
  timestamps: true
});

autoReplyLogSchema.index({ commentId: 1 }, { unique: true });
autoReplyLogSchema.index({ userId: 1 });
autoReplyLogSchema.index({ userId: 1, organizationId: 1 });
autoReplyLogSchema.index({ channelId: 1 });
autoReplyLogSchema.index({ userId: 1, channelId: 1, status: 1, createdAt: -1 });
autoReplyLogSchema.index({ organizationId: 1, channelId: 1, createdAt: -1 });

export default mongoose.model('AutoReplyLog', autoReplyLogSchema);
