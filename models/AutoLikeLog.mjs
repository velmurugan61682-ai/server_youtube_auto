import mongoose from 'mongoose';

const autoLikeLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  channelId: { type: String, required: true },
  videoId: { type: String, required: true },
  commentId: { type: String, required: true },
  processedAt: { type: Date, default: Date.now },
  autoLiked: { type: Boolean, default: true },
  status: { type: String, required: true }
}, { timestamps: true });

autoLikeLogSchema.index({ commentId: 1 }, { unique: true });
autoLikeLogSchema.index({ userId: 1, channelId: 1 });

export default mongoose.model('AutoLikeLog', autoLikeLogSchema);
