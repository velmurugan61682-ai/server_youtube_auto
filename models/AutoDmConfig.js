import mongoose from 'mongoose';

const autoDmConfigSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  videoId: {
    type: String,
    required: true,
    unique: true
  },
  enabled: {
    type: Boolean,
    default: false
  },
  whatsappNumber: {
    type: String,
    required: true
  },
  keywords: {
    type: [String],
    default: ['contact', 'details', 'course', 'help', 'info', 'price']
  },
  replyTemplates: {
    type: [String],
    default: [
      '📲 மேலும் தகவலுக்கு WhatsApp: {whatsapp_link}',
      '💬 Need details? Message me on WhatsApp: {whatsapp_link}',
      '📞 Contact on WhatsApp: {whatsapp_link}'
    ]
  },
  lastRunAt: {
    type: Date
  }
}, {
  timestamps: true
});

export default mongoose.model('AutoDmConfig', autoDmConfigSchema);
