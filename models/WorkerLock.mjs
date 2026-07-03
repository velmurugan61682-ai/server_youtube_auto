import mongoose from 'mongoose';

const workerLockSchema = new mongoose.Schema({
  lockKey: {
    type: String,
    required: true,
    unique: true
  },
  lockedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// TTL index to automatically delete expired locks
workerLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('WorkerLock', workerLockSchema);
