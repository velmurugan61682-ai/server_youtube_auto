import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Alias for backward compatibility
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  plan: { type: String, enum: ['free', 'quarterly_pro', 'annual_pro', 'professional', 'enterprise'], default: 'free', required: true },
  planId: { type: String, default: 'free' },
  planName: { type: String },
  planType: { type: String, default: 'free' },
  status: { type: String, enum: ['active', 'cancelled', 'expired', 'trial', 'created', 'authenticated', 'halted'], default: 'active', required: true },
  subscriptionId: { type: String, unique: true, required: true },
  razorpaySubscriptionId: { type: String },
  razorpayCustomerId: { type: String },
  amount: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  startDate: { type: Date, default: Date.now },
  renewalDate: { type: Date },
  endDate: { type: Date },
  nextBillingDate: { type: Date },
  currentStart: { type: Date, default: Date.now },
  currentEnd: { type: Date },
  endedAt: { type: Date },
  cancelledAt: { type: Date },
  chargeAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

subscriptionSchema.pre('save', function(next) {
  if (this.user && !this.userId) {
    this.userId = this.user;
  } else if (this.userId && !this.user) {
    this.user = this.userId;
  }
  if (this.plan && !this.planId) {
    this.planId = this.plan;
  }
  if (this.subscriptionId && !this.razorpaySubscriptionId) {
    this.razorpaySubscriptionId = this.subscriptionId;
  } else if (this.razorpaySubscriptionId && !this.subscriptionId) {
    this.subscriptionId = this.razorpaySubscriptionId;
  }
  if (typeof next === 'function') next();
});

subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ status: 1 });

export default mongoose.model('Subscription', subscriptionSchema);
