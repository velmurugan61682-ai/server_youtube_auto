import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  youtubeId: { type: String, required: true },
  channelId: { type: String },
  videoId: { type: String, required: true },
  text: { type: String, required: true },
  author: { type: String, required: true },
  authorProfileImageUrl: String,
  // FIX #2: Channel ID of the comment author — used to detect bot's own replies
  authorChannelId: { type: String, default: null },
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

  // FIX #2: True when THIS comment was posted by the bot as an auto-reply.
  // Bot-authored comments are always skipped from toxicity moderation.
  isBotReply: { type: Boolean, default: false },

  // FIX #3: True once a successful bot reply has been posted for THIS comment.
  // Used to prevent duplicate DeepSeek calls and duplicate YouTube replies.
  hasReplied: { type: Boolean, default: false },
  repliedAt: { type: Date, default: null },

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

// ✅ PERFORMANCE: Added indexes for fast queries
commentSchema.index({ userId: 1, youtubeId: 1 }, { unique: true });
commentSchema.index({ userId: 1, status: 1 });              // For status filtering
commentSchema.index({ userId: 1, sentiment: 1 });           // For sentiment analysis
commentSchema.index({ userId: 1, language: 1 });            // For language breakdown
commentSchema.index({ userId: 1, autoLiked: 1 });           // For liked comments
commentSchema.index({ userId: 1, publishedAt: -1 });        // For sorting by date
commentSchema.index({ channelId: 1 });                      // For channel filtering

export default mongoose.model('Comment', commentSchema);
// [FIX APPLIED] Bug #2 & #3 — Added authorChannelId, isBotReply, hasReplied, repliedAt fields to Comment model (models/Comment.mjs)
