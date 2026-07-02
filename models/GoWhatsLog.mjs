import mongoose from 'mongoose';

const goWhatsLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientNumber: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['sent', 'failed'], required: true },
  error: String,
  sentAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('GoWhatsLog', goWhatsLogSchema);
