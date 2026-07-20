import mongoose from 'mongoose';

const liveChatModeSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  channelId: {
    type: String,
    required: true,
    index: true
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

liveChatModeSchema.index({ organizationId: 1, channelId: 1, liveChatId: 1 }, { unique: true });

export default mongoose.model('LiveChatMode', liveChatModeSchema);
