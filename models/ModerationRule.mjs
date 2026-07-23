import mongoose from 'mongoose';

const moderationRuleSchema = new mongoose.Schema({
  // organizationId and channelId indexes defined in schema.index() below — NOT inline to avoid duplicates
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  autoMod: {
    type: Boolean,
    default: true
  },
  confidenceThreshold: {
    type: Number,
    default: 85
  },
  rules: {
    toxicDetection: { type: Boolean, default: true },
    spamDetection: { type: Boolean, default: true },
    hateSpeech: { type: Boolean, default: true },
    abuse: { type: Boolean, default: true },
    scam: { type: Boolean, default: true },
    sexualContent: { type: Boolean, default: true },
    duplicateComments: { type: Boolean, default: true },
    linkSpam: { type: Boolean, default: true }
  },
  action: {
    type: String,
    enum: ['delete', 'hold'],
    default: 'delete'
  }
}, { timestamps: true });

// Compound unique index per organization and channel (covers both fields — no separate single-field indexes needed)
moderationRuleSchema.index({ organizationId: 1, channelId: 1 }, { unique: true });

export default mongoose.model('ModerationRule', moderationRuleSchema);
