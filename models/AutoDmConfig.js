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

// FIX #4: Validate that reply templates use the {whatsapp_link} placeholder
// and NOT a raw URL wrapped in curly braces like {https://wa.me/...}.
// This prevents malformed templates (the "%7D issue") from being saved.
const HARDCODED_URL_IN_BRACES = /\{https?:\/\//;

const isValidReplyTemplate = (template) => {
  if (typeof template !== 'string') return false;
  if (HARDCODED_URL_IN_BRACES.test(template)) {
    return false; // Contains a literal URL wrapped in braces — reject
  }
  return true;
};
// END FIX #4 — validation helper

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
    ],
    // FIX #4: Reject any template that hard-codes a URL inside braces
    // (e.g. "{https://wa.me/9047544059}") — the {whatsapp_link} placeholder must be used.
    validate: {
      validator: function(templates) {
        return templates.every(isValidReplyTemplate);
      },
      message: 'One or more reply templates contain a hardcoded URL in curly braces (e.g. "{https://wa.me/...}"). Use the {whatsapp_link} placeholder instead.'
    }
  },
  lastRunAt: {
    type: Date
  }
}, {
  timestamps: true
});

autoDmConfigSchema.index({ userId: 1, channelId: 1 }); // Index for fast user configuration fetches

export default mongoose.model('AutoDmConfig', autoDmConfigSchema);
