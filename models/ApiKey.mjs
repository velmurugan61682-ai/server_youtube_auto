import mongoose from 'mongoose';

// ── Available permission scopes ──────────────────────────────────────────────
export const VALID_PERMISSIONS = [
  'leads:read',
  'leads:write',
  'users:read',
  'customers:read',
  'comments:read',
  'analytics:read',
];

const apiKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  key: {
    type: String,
    required: true,
    unique: true
  },
  // Granted permission scopes for this key
  permissions: {
    type: [String],
    enum: VALID_PERMISSIONS,
    default: ['leads:read', 'leads:write', 'users:read', 'customers:read', 'comments:read', 'analytics:read']
  },
  // Per-key rate limit in requests per hour (default: 500)
  rateLimit: {
    requestsPerHour: {
      type: Number,
      default: 500,
      min: 1,
      max: 10000
    }
  },
  // Optional hard expiry — null means never expires
  expiresAt: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsedAt: {
    type: Date
  },
  // Cumulative usage counter (lifetime)
  usageCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Index for fast key lookup in auth middleware
apiKeySchema.index({ key: 1, isActive: 1 });
apiKeySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('ApiKey', apiKeySchema);
