import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  logo: { type: String, default: '' },
  contactDetails: {
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' }
  },
  subscription: {
    status: { type: String, enum: ['none', 'created', 'active', 'cancelled', 'expired', 'halted'], default: 'none' },
    planType: { type: String, enum: ['starter', 'professional', 'business', 'enterprise', 'free', 'one_rupee', 'monthly_345', 'two_months_600', 'three_months_999', 'quarterly', 'none'], default: 'free' },
    razorpaySubscriptionId: { type: String, default: '' },
    currentPeriodEnd: { type: Date }
  },
  apiKeys: {
    youtubeApiKey: { type: String, default: '' },
    openaiApiKey: { type: String, default: '' },
    gowhatsApiKey: { type: String, default: '' },
    gowhatsUrl: { type: String, default: '' }
  },
  aiConfig: {
    confidenceThreshold: { type: Number, default: 85 },
    languages: { type: [String], default: ['English', 'Tamil', 'Tanglish'] }
  },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Organization', organizationSchema);
