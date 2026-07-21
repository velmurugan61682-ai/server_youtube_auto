import mongoose from 'mongoose';

const carouselCardSchema = new mongoose.Schema({
  imageUrl: { type: String, default: '' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  btnLabel: { type: String, default: 'View Detail' },
  link: { type: String, default: '' },
  buttonText: { type: String, default: 'View Detail' },
  buttonUrl: { type: String, default: '' }
}, { _id: false });

const commentAutomationRuleSchema = new mongoose.Schema({
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
  name: {
    type: String,
    required: true
  },
  triggerText: {
    type: String,
    default: '*'
  },
  triggerType: {
    type: String,
    enum: ['contains_any', 'contains_all', 'exact_match', 'any_comment', 'ai_intent'],
    default: 'contains_any'
  },
  keywords: {
    type: [String],
    default: []
  },
  replyType: {
    type: String,
    enum: ['Text', 'Carousel'],
    default: 'Text'
  },
  followersOnly: {
    type: Boolean,
    default: false
  },
  replyCommentText: {
    type: String,
    default: ''
  },
  automatedDmContent: {
    type: String,
    default: ''
  },
  carouselCards: {
    type: [carouselCardSchema],
    default: []
  },
  ruleType: {
    type: String,
    enum: ['text', 'template'],
    default: 'text'
  },
  replyText: {
    type: String,
    default: ''
  },
  replyTemplates: {
    type: [String],
    default: []
  },
  templateSelectionMode: {
    type: String,
    enum: ['random', 'sequential'],
    default: 'random'
  },
  videoIds: {
    type: [String],
    default: [] // Empty array represents channel-wide (All Videos)
  },
  videoId: {
    type: String,
    default: null
  },
  applyToAllVideos: {
    type: Boolean,
    default: true
  },
  publicReplyEnabled: {
    type: Boolean,
    default: true
  },
  aiReplyEnabled: {
    type: Boolean,
    default: false
  },
  aiTone: {
    type: String,
    enum: ['Professional', 'Friendly', 'Helpful', 'Sales', 'Concise', 'Custom'],
    default: 'Friendly'
  },
  customTone: {
    type: String,
    default: ''
  },
  maxReplyLength: {
    type: Number,
    default: 200
  },
  status: {
    type: String,
    enum: ['Active', 'Paused'],
    default: 'Active'
  },
  triggeredCount: {
    type: Number,
    default: 0
  },
  successfulReplyCount: {
    type: Number,
    default: 0
  },
  failedReplyCount: {
    type: Number,
    default: 0
  },
  lastTriggeredAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for fast fetching
commentAutomationRuleSchema.index({ userId: 1 });
commentAutomationRuleSchema.index({ channelId: 1 });
commentAutomationRuleSchema.index({ status: 1 });
commentAutomationRuleSchema.index({ userId: 1, organizationId: 1, channelId: 1 });
commentAutomationRuleSchema.index({ organizationId: 1, channelId: 1, createdAt: -1 });

export default mongoose.model('CommentAutomationRule', commentAutomationRuleSchema);
