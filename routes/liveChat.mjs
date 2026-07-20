import express from 'express';
import { authMiddleware } from '../middleware/auth.mjs';
import { requireActiveSubscription, requireFeature } from '../middleware/subscription.mjs';
import { 
  toggleMode, 
  getMessages, 
  sendMessage, 
  syncLiveChat 
} from '../controllers/liveChatController.mjs';

const router = express.Router();

router.post('/toggle-mode', authMiddleware, requireActiveSubscription, requireFeature('liveChatAutomation'), toggleMode);
router.get('/messages', authMiddleware, requireActiveSubscription, getMessages);
router.post('/send', authMiddleware, requireActiveSubscription, sendMessage);
router.post('/sync', authMiddleware, requireActiveSubscription, syncLiveChat);

export default router;
