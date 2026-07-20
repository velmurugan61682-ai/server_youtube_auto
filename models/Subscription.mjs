import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  razorpaySubscriptionId: { type: String, required: true, unique: true },
  razorpayCustomerId: { type: String },
  planId: { type: String, required: true },
  planName: { type: String },
  planType: { type: String, default: 'free' },
  amount: { type: Number, default: 0 },
  status: { type: String, required: true, enum: ['created', 'authenticated', 'active', 'halted', 'cancelled', 'completed', 'expired'] },
  startDate: { type: Date },
  endDate: { type: Date },
  nextBillingDate: { type: Date },
  currentStart: { type: Date },
  currentEnd: { type: Date },
  endedAt: { type: Date },
  cancelledAt: { type: Date },
  chargeAt: { type: Date }
}, { timestamps: true });

// Add indexes for optimized queries
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ organizationId: 1, status: 1 });
subscriptionSchema.index({ razorpaySubscriptionId: 1 });
subscriptionSchema.index({ status: 1 });

export default mongoose.model('Subscription', subscriptionSchema);

