import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  razorpayPaymentId: { type: String, required: true },
  razorpayOrderId: { type: String },
  razorpaySubscriptionId: { type: String },
  subscriptionId: { type: String },
  razorpaySignature: { type: String },
  amount: { type: Number, required: true }, // in paise
  currency: { type: String, default: 'INR' },
  status: { type: String, required: true, enum: ['captured', 'failed', 'refunded', 'authorized', 'created'] },
  paymentDate: { type: Date, default: Date.now },
  invoiceId: { type: String },
  method: { type: String },
  errorDescription: { type: String },
}, { timestamps: true });

// Schema-level indexes for optimized queries
paymentSchema.index({ razorpayPaymentId: 1 }, { unique: true });
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ organizationId: 1, createdAt: -1 });
paymentSchema.index({ razorpaySubscriptionId: 1 });
paymentSchema.index({ subscriptionId: 1 });

export default mongoose.model('Payment', paymentSchema);
