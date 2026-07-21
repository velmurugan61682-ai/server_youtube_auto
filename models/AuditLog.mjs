import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  adminEmail: { type: String },
  action: { type: String, required: true }, // e.g. "ONBOARD_CLIENT", "UPDATE_USER", "DELETE_USER", "UPDATE_SUBSCRIPTION", "CANCEL_SUBSCRIPTION"
  targetType: { type: String, enum: ['User', 'Subscription', 'Admin', 'Client'] },
  targetId: { type: mongoose.Schema.Types.ObjectId },
  details: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now }
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ targetId: 1 });

export default mongoose.model('AuditLog', auditLogSchema);
