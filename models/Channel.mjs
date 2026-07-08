import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  channelId: { type: String, required: true, unique: true },
  title: String,
  customUrl: String,
  description: String,
  thumbnailUrl: String,
  accessToken: String,
  refreshToken: String,
  expiryDate: Number,
  apiKey: String,
  uploadsPlaylistId: String,
  statistics: {
    subscriberCount: { type: String, default: '0' },
    videoCount: { type: String, default: '0' },
    viewCount: { type: String, default: '0' }
  },
  settings: {
    autoLikePositive: { type: Boolean, default: true },
    autoReplyPositive: { type: Boolean, default: false },
    autoReplyMessage: { type: String, default: 'Thanks for the great comment!' },
    confidenceThreshold: { type: Number, default: 0.85 },
    toxicThreshold: { type: Number, default: 0.7 },
  },
  playlists: { type: Array, default: [] },
  lastSyncedAt: Date,
  reconnectRequired: { type: Boolean, default: false },
  reconnectReason: String,
}, { timestamps: true });

channelSchema.index({ userId: 1, channelId: 1 }, { unique: true });

export default mongoose.model('Channel', channelSchema);
