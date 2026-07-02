import mongoose from 'mongoose';

const automationLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actionType: { type: String, required: true }, // e.g. 'comment_delete', 'comment_reply', 'video_analysis', 'lead_generation'
  description: { type: String, required: true },
  details: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('AutomationLog', automationLogSchema);
