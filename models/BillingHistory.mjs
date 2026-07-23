import mongoose from 'mongoose';

const billingHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  razorpayInvoiceId: { type: String },
  razorpaySubscriptionId: { type: String },
  razorpayPaymentId: { type: String },
  amount: { type: Number, required: true }, // in paise
  planType: { type: String, required: true },
  invoiceUrl: { type: String },
  billingDate: { type: Date, default: Date.now },
  status: { type: String, required: true, enum: ['paid', 'unpaid', 'issued'] }
}, { timestamps: true });

// Schema-level indexes for optimized queries
billingHistorySchema.index({ razorpayInvoiceId: 1 }, { unique: true, sparse: true });
billingHistorySchema.index({ userId: 1 });
billingHistorySchema.index({ organizationId: 1 });
billingHistorySchema.index({ razorpaySubscriptionId: 1 });

export default mongoose.model('BillingHistory', billingHistorySchema);
