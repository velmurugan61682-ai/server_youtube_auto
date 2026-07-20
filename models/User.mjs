import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'client'], default: 'client' },
  profilePicture: { type: String, default: '' },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  subscription: {
    id: { type: String, default: '' },
    planId: { type: String, default: '' },
    status: { type: String, enum: ['none', 'created', 'active', 'cancelled', 'expired', 'halted'], default: 'none' },
    currentStart: { type: Date },
    currentEnd: { type: Date }
  },
  youtubeApiKey: { type: String, default: '' },
  youtubeChannelId: { type: String, default: '' },
  openaiApiKey:   { type: String, default: '' },
  gowhatsApiKey:  { type: String, default: '' },
  gowhatsUrl:     { type: String, default: '' },
  productLink:    { type: String, default: '' },
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

// Add indexes for optimized queries (email index omitted — created automatically by unique:true above)
userSchema.index({ organizationId: 1 });
userSchema.index({ role: 1, createdAt: -1 });

export default mongoose.model('User', userSchema);

