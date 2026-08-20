import mongoose from 'mongoose';

const scheduledUploadSchema = new mongoose.Schema({
  videoId: {
    type: String,
    default: null
  },
  fileName: {
    type: String,
    default: null
  },
  channelId: {
    type: String,
    required: true
  },
  mode: {
    type: String,
    enum: ['auto', 'manual'],
    required: true
  },
  scheduledTime: {
    type: Date,
    required: true
  },
  reason: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'publishing', 'published', 'failed'],
    default: 'scheduled'
  },
  errorMessage: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ✅ PERFORMANCE: All indexes defined here for fast query paths
scheduledUploadSchema.index({ scheduledTime: 1, status: 1 });          // worker polling: pending/scheduled items due now
scheduledUploadSchema.index({ channelId: 1 });                         // fast lookup by channel
scheduledUploadSchema.index({ channelId: 1, status: 1, scheduledTime: 1 }); // compound for AutoSchedule.jsx queue fetch
scheduledUploadSchema.index({ videoId: 1 });                           // fast lookup by video
scheduledUploadSchema.index({ createdAt: -1 });                        // dashboard timeline ordering

export default mongoose.model('ScheduledUpload', scheduledUploadSchema);
