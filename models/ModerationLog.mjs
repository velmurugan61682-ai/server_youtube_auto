import mongoose from 'mongoose';

const moderationLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  channelId: {
    type: String,
    required: true
  },
  videoId: {
    type: String,
    required: true
  },
  commentId: {
    type: String,
    required: true
  },
  authorName: {
    type: String,
    default: 'Anonymous'
  },
  commentText: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    required: true // e.g. toxic, spam, profanity, scam, abusive, Tanglish
  },
  type: {
    type: String // alias of category
  },
  confidence: {
    type: Number,
    default: 90
  },
  toxicityScore: {
    type: Number,
    default: 0.9
  },
  reason: {
    type: String,
    default: null
  },
  recommendedAction: {
    type: String,
    default: null // e.g. delete, spam, published, rejected, hold
  },
  executedAction: {
    type: String,
    default: null // e.g. delete, spam, published, rejected, hold
  },
  action: {
    type: String // alias of executedAction
  },
  status: {
    type: String,
    enum: ['Pending', 'Success', 'Failed'],
    default: 'Success'
  },
  failureReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
moderationLogSchema.index({ userId: 1 });
moderationLogSchema.index({ channelId: 1 });
moderationLogSchema.index({ videoId: 1 });
moderationLogSchema.index({ status: 1 });
moderationLogSchema.index({ createdAt: 1 });
moderationLogSchema.index({ commentId: 1, userId: 1 }); // fast per-comment lookup
moderationLogSchema.index({ userId: 1, channelId: 1, createdAt: -1 }); // dashboard timeline
moderationLogSchema.index({ userId: 1, organizationId: 1, channelId: 1 });
moderationLogSchema.index({ organizationId: 1, channelId: 1, createdAt: -1 });

export default mongoose.model('ModerationLog', moderationLogSchema);
