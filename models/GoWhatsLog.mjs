import mongoose from 'mongoose';

const goWhatsLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
  channelId: { type: String, default: null },
  videoId: { type: String, default: null },
  recipientNumber: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['sent', 'failed'], required: true },
  error: String,
  sentAt: { type: Date, default: Date.now }
}, { timestamps: true });

goWhatsLogSchema.index({ userId: 1, createdAt: -1 });
goWhatsLogSchema.index({ leadId: 1 });

export default mongoose.model('GoWhatsLog', goWhatsLogSchema);
