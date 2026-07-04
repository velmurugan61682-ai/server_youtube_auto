import mongoose from 'mongoose';

/**
 * Validates that a videoId is not a known placeholder/test pattern.
 * Real YouTube video IDs are 11 characters (e.g., 'dQw4w9WgXcQ').
 */
const INVALID_VIDEO_ID_PATTERNS = [
  /^test/i,
  /^example/i,
  /^placeholder/i,
  /^xxx/i,
  /^fake/i,
  /^demo/i,
  /^sample/i,
];

const isValidVideoId = (videoId) => {
  if (!videoId || typeof videoId !== 'string') return false;
  if (videoId.trim().length < 6) return false;
  return !INVALID_VIDEO_ID_PATTERNS.some((pattern) => pattern.test(videoId.trim()));
};

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
    unique: true,
    validate: {
      validator: isValidVideoId,
      message: (props) => `"${props.value}" is not a valid YouTube video ID. Placeholder or test IDs are not allowed.`
    }
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
