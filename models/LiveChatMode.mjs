import mongoose from 'mongoose';

const liveChatModeSchema = new mongoose.Schema({
  // organizationId and channelId indexes defined in schema.index() below — NOT inline to avoid duplicates
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  liveChatId: {
    type: String,
    required: true
  },
  videoId: {
    type: String,
    default: ''
  },
  mode: {
    type: String,
    enum: ['bot', 'human'],
    default: 'bot'
  },
  handledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

// Compound unique index covers organizationId, channelId, and liveChatId (no separate single-field indexes needed)
liveChatModeSchema.index({ organizationId: 1, channelId: 1, liveChatId: 1 }, { unique: true });

export default mongoose.model('LiveChatMode', liveChatModeSchema);
