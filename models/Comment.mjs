import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  youtubeId: { type: String, required: true },
  channelId: { type: String },
  videoId: { type: String, required: true },
  text: { type: String, required: true },
  author: { type: String, required: true },
  authorProfileImageUrl: String,
  publishedAt: { type: Date, required: true },
  sentiment: { type: String, default: 'neutral' },
  toxicityScore: { type: Number, default: 0 },
  confidence: { type: Number, default: 0 },
  language: { type: String, default: 'unknown' },
  detectedWords: [{
    word: String,
    category: String
  }],
  status: { type: String, enum: ['pending', 'approved', 'deleted', 'flagged'], default: 'pending' },
  likeStatus: { type: String, enum: ['none', 'success', 'failed', 'not_supported', 'replied'], default: 'none' },
  likeError: String,
  aiActionTaken: { type: Boolean, default: false },
  autoLiked: { type: Boolean, default: false },
  deleteFailed: { type: Boolean, default: false },
  deleteError: String,
  moderatedBy: String,
  moderatedAt: Date,
  note: { type: String, default: '' },
  
  // AI Automation additions
  classification: String,
  suggestedReply: String,
  replyText: String,
  replyStatus: { type: String, enum: ['none', 'pending', 'sent', 'failed'], default: 'none' },
  replyError: String,
  deleteReason: String,
  deletedAt: Date,
  moderationStatus: String,
  aiStatus: String,
  actionTaken: String,
  moderationReason: String,
}, { timestamps: true });

commentSchema.index({ userId: 1, youtubeId: 1 }, { unique: true });

export default mongoose.model('Comment', commentSchema);
