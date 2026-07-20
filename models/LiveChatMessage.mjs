import mongoose from 'mongoose';

const liveChatMessageSchema = new mongoose.Schema({
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
    required: true,
    index: true
  },
  videoId: {
    type: String,
    default: ''
  },
  messageId: {
    type: String,
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  authorChannelId: {
    type: String,
    default: null
  },
  authorProfileImageUrl: {
    type: String,
    default: ''
  },
  messageText: {
    type: String,
    required: true
  },
  isOwner: {
    type: Boolean,
    default: false
  },
  isBotReply: {
    type: Boolean,
    default: false
  },
  senderType: {
    type: String,
    enum: ['user', 'bot', 'human_agent'],
    default: 'user'
  },
  publishedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

liveChatMessageSchema.index({ messageId: 1, organizationId: 1 }, { unique: true });
liveChatMessageSchema.index({ organizationId: 1, channelId: 1, liveChatId: 1, publishedAt: -1 });

export default mongoose.model('LiveChatMessage', liveChatMessageSchema);
