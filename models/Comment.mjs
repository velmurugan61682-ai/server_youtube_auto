import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // organizationId index is defined in schema.index() below — NOT inline to avoid duplicate
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  youtubeId: { type: String, required: true },
  commentId: { type: String, unique: true, sparse: true }, // unique alias of youtubeId
  channelId: { type: String },
  videoId: { type: String, required: true },
  text: { type: String, required: true },
  commentText: { type: String }, // alias of text
  author: { type: String, required: true },
  username: { type: String }, // alias of author
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
  status: { type: String, enum: ['pending', 'processing', 'approved', 'deleted', 'flagged', 'moderate'], default: 'pending' },
  likeStatus: { type: String, enum: ['none', 'success', 'failed', 'not_supported', 'replied'], default: 'none' },
  likeError: String,
  aiActionTaken: { type: Boolean, default: false },
  autoLiked: { type: Boolean, default: false },
  deleteFailed: { type: Boolean, default: false },
  deleteError: String,
  moderatedBy: String,
  moderatedAt: Date,
  note: { type: String, default: '' },
  isModerated: { type: Boolean, default: false },
  moderationAction: { type: String, default: null },

  // FIX #2: True when THIS comment was posted by the bot as an auto-reply.
  // Bot-authored comments are always skipped from toxicity moderation.
  isBotReply: { type: Boolean, default: false },
  parentCommentId: { type: String, default: null },
  isReply: { type: Boolean, default: false },

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
  // textHash index is defined in schema.index() below — NOT inline to avoid duplicate
  textHash: { type: String },
}, { timestamps: true });

// ✅ PERFORMANCE: All indexes defined here (schema-level only — no inline index:true duplicates)
commentSchema.index({ userId: 1, youtubeId: 1 }, { unique: true });
commentSchema.index({ organizationId: 1 });                         // was inline index:true — moved here
commentSchema.index({ textHash: 1 });                               // was inline index:true — moved here
commentSchema.index({ userId: 1, status: 1 });
commentSchema.index({ userId: 1, sentiment: 1 });
commentSchema.index({ userId: 1, language: 1 });
commentSchema.index({ userId: 1, autoLiked: 1 });
commentSchema.index({ userId: 1, publishedAt: -1 });
commentSchema.index({ channelId: 1 });
commentSchema.index({ userId: 1, channelId: 1, status: 1, publishedAt: -1 });
commentSchema.index({ userId: 1, videoId: 1, publishedAt: -1 });
commentSchema.index({ userId: 1, organizationId: 1, channelId: 1 });
commentSchema.index({ organizationId: 1, channelId: 1, createdAt: -1 });
commentSchema.index({ userId: 1, organizationId: 1, channelId: 1, videoId: 1, textHash: 1, createdAt: -1 });

export default mongoose.model('Comment', commentSchema);
// [FIX APPLIED] Bug #2 & #3 — Added authorChannelId, isBotReply, hasReplied, repliedAt fields to Comment model (models/Comment.mjs)
