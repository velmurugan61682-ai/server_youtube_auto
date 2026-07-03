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
    enum: ['pending', 'scheduled', 'published', 'failed'],
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

// Index to quickly find scheduled uploads sorted by scheduledTime
scheduledUploadSchema.index({ scheduledTime: 1, status: 1 });

export default mongoose.model('ScheduledUpload', scheduledUploadSchema);
