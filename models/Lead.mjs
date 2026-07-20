import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  idempotencyKey: { type: String, unique: true, sparse: true },
  channelId: { type: String, default: 'API' },
  videoId: { type: String, default: 'API' },
  commentId: { type: String, unique: true, default: () => 'ext_' + new mongoose.Types.ObjectId().toString() },
  authorName: { type: String, required: true },
  originalComment: { type: String, required: true },
  whatsappNumber: { type: String },
  email: String,
  intent: String,
  productInterest: String,
  language: String,
  notes: String,
  status: { 
    type: String, 
    enum: ['pending', 'sent', 'failed', 'duplicate'], 
    default: 'pending' 
  },
  isHidden: { type: Boolean, default: false },
  whatsappSent: { type: Boolean, default: false },
  errorLog: { type: String },
  detectedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for duplicate protection and fast lookups
leadSchema.index({ whatsappNumber: 1, createdAt: -1 });
leadSchema.index({ userId: 1, channelId: 1, createdAt: -1 });
leadSchema.index({ userId: 1, organizationId: 1, channelId: 1 });
leadSchema.index({ organizationId: 1, channelId: 1, createdAt: -1 });

export default mongoose.model('Lead', leadSchema);
