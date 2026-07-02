import mongoose from 'mongoose';

const commentLogSchema = new mongoose.Schema({
  commentId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  videoId: { 
    type: String, 
    required: true 
  },
  commenterName: { 
    type: String, 
    required: true 
  },
  originalText: { 
    type: String, 
    required: true 
  },
  category: { 
    type: String, 
    enum: ['normal', 'toxic', 'spam', 'review'], 
    required: true 
  },
  reason: { 
    type: String 
  },
  actionTaken: { 
    type: String, 
    enum: ['reply_posted', 'comment_hidden', 'comment_removed', 'none'], 
    default: 'none' 
  },
  replyText: { 
    type: String,
    set: function(val) {
      if (val && typeof val === 'object' && val.detectedLanguage) {
        this.detectedLanguage = val.detectedLanguage;
      }
      return val;
    }
  },
  detectedLanguage: {
    type: String
  },
  whatsappSent: { 
    type: Boolean, 
    default: false 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  timestamps: true 
});

commentLogSchema.index({ commentId: 1 });
commentLogSchema.index({ videoId: 1 });

export default mongoose.model('CommentLog', commentLogSchema);
