import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  passwordHash: { type: String }, // Virtual or fallback alias for password
  role: { type: String, enum: ['admin', 'client', 'superadmin', 'support'], default: 'client' },
  organization: { type: String, default: '' },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  profilePicture: { type: String, default: '' },
  tenantId: { type: String },
  assignedAgent: { type: String, enum: ['AI Agent', 'Human Agent'], default: 'AI Agent' },
  assignedAgentType: { type: String, enum: ['ai_agent', 'human_agent', 'AI Agent', 'Human Agent'], default: 'ai_agent' },
  status: { type: String, enum: ['active', 'suspended', 'pending', 'blocked', 'expired'], default: 'active' },
  youtubeChannelsConnected: [{
    channelId: { type: String },
    channelName: { type: String },
    connectedAt: { type: Date, default: Date.now }
  }],
  subscription: {
    id: { type: String, default: '' },
    planId: { type: String, default: 'free' },
    status: { type: String, enum: ['none', 'created', 'active', 'cancelled', 'expired', 'halted', 'trial'], default: 'active' },
    currentStart: { type: Date, default: Date.now },
    currentEnd: { type: Date }
  },
  subscriptionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  youtubeApiKey: { type: String, default: '' },
  youtubeChannelId: { type: String, default: '' },
  openaiApiKey:   { type: String, default: '' },
  gowhatsApiKey:  { type: String, default: '' },
  gowhatsUrl:     { type: String, default: '' },
  productLink:    { type: String, default: '' },
  lastLoginAt:    { type: Date },
  deletedAt:      { type: Date },
  settings: {
    autoMod: { type: Boolean, default: true },
    autoLike: { type: Boolean, default: true },
    smartAiReply: { type: Boolean, default: true },
    confidenceThreshold: { type: Number, default: 85 },
    languages: { type: [String], default: ['English', 'Tamil', 'Tanglish'] },
    realTimeAlerts: { type: Boolean, default: true },
    moderationRules: {
      toxicDetection: { type: Boolean, default: true },
      spamDetection: { type: Boolean, default: true },
      hateSpeech: { type: Boolean, default: true },
      abuse: { type: Boolean, default: true },
      scam: { type: Boolean, default: true },
      sexualContent: { type: Boolean, default: true },
      duplicateComments: { type: Boolean, default: true },
      linkSpam: { type: Boolean, default: true },
    },
    moderationAction: { type: String, enum: ['delete', 'hold'], default: 'delete' },
    leadKeywords: { type: [String], default: ['price', 'details', 'course', 'join', 'contact', 'phone', 'call', 'whatsapp', 'demo', 'fees'] },
  },
  createdAt: { type: Date, default: Date.now }
});

// Middleware to keep password/passwordHash in sync & auto-generate tenantId
userSchema.pre('save', function(next) {
  if (this.password && !this.passwordHash) {
    this.passwordHash = this.password;
  } else if (this.passwordHash && !this.password) {
    this.password = this.passwordHash;
  }
  if (!this.tenantId) {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    this.tenantId = `T-${randomDigits}`;
  }
  if (typeof next === 'function') next();
});

// Remove sensitive passwordHash from API responses automatically
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

userSchema.index({ organizationId: 1 });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ status: 1 });

export default mongoose.model('User', userSchema);
