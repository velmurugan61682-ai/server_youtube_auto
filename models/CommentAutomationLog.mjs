import mongoose from 'mongoose';

const commentAutomationLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // organizationId index defined in schema.index() below — NOT inline to avoid duplicate
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  ruleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommentAutomationRule',
    required: true
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
  parentCommentId: {
    type: String,
    default: null
  },
  authorName: {
    type: String,
    required: true
  },
  authorChannelId: {
    type: String,
    default: null
  },
  commentText: {
    type: String,
    required: true
  },
  matchedKeyword: {
    type: String,
    default: null
  },
  generatedReply: {
    type: String,
    default: null
  },
  replyId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Replied', 'Failed', 'Skipped', 'Deleted', 'Hidden'],
    default: 'Pending'
  },
  failureReason: {
    type: String,
    default: null
  },
  attemptCount: {
    type: Number,
    default: 0
  },
  processedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound unique index to prevent duplicate processing of the same comment by the same rule
commentAutomationLogSchema.index({ commentId: 1, ruleId: 1 }, { unique: true });

// All regular indexes at schema-level (no inline index:true duplicates)
commentAutomationLogSchema.index({ organizationId: 1 }); // was inline index:true — moved here
commentAutomationLogSchema.index({ userId: 1 });
commentAutomationLogSchema.index({ channelId: 1 });
commentAutomationLogSchema.index({ videoId: 1 });
commentAutomationLogSchema.index({ status: 1 });
commentAutomationLogSchema.index({ createdAt: 1 });
commentAutomationLogSchema.index({ userId: 1, organizationId: 1, channelId: 1 });
commentAutomationLogSchema.index({ organizationId: 1, channelId: 1, createdAt: -1 });

export default mongoose.model('CommentAutomationLog', commentAutomationLogSchema);
