import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  channelId: { type: String, required: true },
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  thumbnail: String,
  publishedAt: Date,
  // Video Analysis Fields
  analyzed: { type: Boolean, default: false },
  analysis: {
    tags: [String],
    category: String,
    language: String,
    keywords: [String],
    sentiment: String,
    topic: String,
    seoQuality: String,
    summary: String,
    analyzedAt: Date
  },
  // Video Analytics Stats & Caching
  statistics: {
    viewCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 }
  },
  likesHistory: [
    {
      date: { type: Date, default: Date.now },
      likeCount: { type: Number, default: 0 }
    }
  ],
  engagementRate: { type: Number, default: 0 },
  likedByUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  duration: String,
  isPost: { type: Boolean, default: false },
  isLive: { type: Boolean, default: false },
  liveBroadcastContent: { type: String, default: 'none' },
  liveChatId: { type: String, default: '' },
  lastFetchedAt: Date
}, { timestamps: true });

videoSchema.index({ channelId: 1, videoId: 1 }, { unique: true });
videoSchema.index({ userId: 1, videoId: 1 });
videoSchema.index({ userId: 1, channelId: 1, publishedAt: -1 }); // Compound index for channel video queries
videoSchema.index({ channelId: 1, isLive: 1 });

export default mongoose.model('Video', videoSchema);
