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
router.post('/toggle-mode', authMiddleware, requireActiveSubscription, requireFeature('liveChatAutomation'), toggleMode);
router.get('/messages', authMiddleware, requireActiveSubscription, getMessages);
router.post('/send', authMiddleware, requireActiveSubscription, sendMessage);
router.post('/sync', authMiddleware, requireActiveSubscription, syncLiveChat);
router.post('/delete', authMiddleware, requireActiveSubscription, deleteLiveMessage);
router.post('/hide', authMiddleware, requireActiveSubscription, hideLiveMessage);
router.post('/reply', authMiddleware, requireActiveSubscription, replyLiveMessage);

export default router;
