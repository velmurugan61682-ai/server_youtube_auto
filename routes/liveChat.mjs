import express from 'express';
import { authMiddleware } from '../middleware/auth.mjs';
import { requireActiveSubscription, requireFeature } from '../middleware/subscription.mjs';
import { 
  toggleMode, 
  getMessages, 
  sendMessage, 
  syncLiveChat,
  getLiveStreams,
  deleteLiveMessage,
  hideLiveMessage,
  replyLiveMessage
} from '../controllers/liveChatController.mjs';

const router = express.Router();

router.get('/streams', authMiddleware, requireActiveSubscription, getLiveStreams);
router.post('/toggle-mode', authMiddleware, requireActiveSubscription, requireFeature('liveStreamingCommentReply'), toggleMode);
router.get('/messages', authMiddleware, requireActiveSubscription, getMessages);
router.post('/send', authMiddleware, requireActiveSubscription, requireFeature('liveStreamingCommentReply'), sendMessage);
router.post('/sync', authMiddleware, requireActiveSubscription, requireFeature('liveStreamingCommentReply'), syncLiveChat);
router.post('/delete', authMiddleware, requireActiveSubscription, deleteLiveMessage);
router.post('/hide', authMiddleware, requireActiveSubscription, hideLiveMessage);
router.post('/reply', authMiddleware, requireActiveSubscription, requireFeature('liveStreamingCommentReply'), replyLiveMessage);

export default router;

