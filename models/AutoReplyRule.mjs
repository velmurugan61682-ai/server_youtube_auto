import mongoose from 'mongoose';

const autoReplyRuleSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'Untitled Rule'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  },
  channelId: {
    type: String,
    required: true
  },
  videoIds: {
    type: [String],
    default: []
  },
  contentType: {
    type: String,
    default: 'all' // 'all' or 'video'
  },
  triggerKeywords: {
    type: [String],
    default: []
  },
  matchType: {
    type: String,
    default: 'contains_any'
  },
  replyType: {
    type: String,
    default: 'Text'
  },
  replyText: {
    type: String,
    default: ''
  },
  dmContent: {
    type: String,
    default: ''
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
  subscribersOnly: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

autoReplyRuleSchema.index({ userId: 1 });
autoReplyRuleSchema.index({ channelId: 1 });
autoReplyRuleSchema.index({ isActive: 1 });
autoReplyRuleSchema.index({ userId: 1, channelId: 1, isActive: 1 });

export default mongoose.model('AutoReplyRule', autoReplyRuleSchema);

