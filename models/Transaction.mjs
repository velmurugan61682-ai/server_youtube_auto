import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  razorpayPaymentId: { type: String },
  razorpaySubscriptionId: { type: String },
  amount: { type: Number, required: true }, // in paise
  type: { type: String, required: true, enum: ['credit', 'debit'] },
  status: { type: String, required: true, enum: ['success', 'pending', 'failed'] },
  description: { type: String }
}, { timestamps: true });

// Add index for optimized queries
transactionSchema.index({ userId: 1 });
transactionSchema.index({ organizationId: 1 });
transactionSchema.index({ razorpayPaymentId: 1 });
transactionSchema.index({ razorpaySubscriptionId: 1 });

export default mongoose.model('Transaction', transactionSchema);
