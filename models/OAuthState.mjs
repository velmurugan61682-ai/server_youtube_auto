import mongoose from 'mongoose';

const oauthStateSchema = new mongoose.Schema({
  state: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null
  },
  isLoginFlow: {
    type: Boolean,
    default: false
  },
  redirectUrl: {
    type: String,
    default: null
  },
  frontendUrl: {
    type: String,
    default: null
  },
  lastToken: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300 // 5 minutes TTL
  }
});

export default mongoose.model('OAuthState', oauthStateSchema);
