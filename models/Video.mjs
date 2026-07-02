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
  }
}, { timestamps: true });

videoSchema.index({ userId: 1, videoId: 1 }, { unique: true });

export default mongoose.model('Video', videoSchema);
