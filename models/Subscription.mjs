import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  razorpaySubscriptionId: { type: String, required: true, unique: true },
  planId: { type: String, required: true },
  planType: { type: String, required: true },
  status: { type: String, required: true, enum: ['created', 'authenticated', 'active', 'halted', 'cancelled', 'completed', 'expired'] },
  currentStart: { type: Date },
  currentEnd: { type: Date },
  endedAt: { type: Date },
  cancelledAt: { type: Date },
  chargeAt: { type: Date }
}, { timestamps: true });

// Add index for optimized queries
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ organizationId: 1 });
subscriptionSchema.index({ razorpaySubscriptionId: 1 });

export default mongoose.model('Subscription', subscriptionSchema);
