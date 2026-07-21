import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'support'], default: 'support' },
  lastLoginAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

adminSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

adminSchema.index({ role: 1 });

export default mongoose.model('Admin', adminSchema);
