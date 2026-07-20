import express from 'express';
import { 
  initiateAuth, 
  handleCallback, 
  getChannels, 
  deleteChannel, 
  getVideos,
  getVideoAnalytics,
  likeVideoDashboard
} from '../controllers/youtubeController.mjs';
import { authMiddleware } from '../middleware/auth.mjs';
import { requireActiveSubscription, checkChannelLimit } from '../middleware/subscription.mjs';

const router = express.Router();

router.post('/auth/initiate', authMiddleware, requireActiveSubscription, checkChannelLimit, initiateAuth);
router.get('/callback', handleCallback);
router.get('/channels', authMiddleware, getChannels);
router.delete('/channels/:channelId', authMiddleware, deleteChannel);
router.get('/videos', authMiddleware, getVideos);
router.get('/video/:id/analytics', authMiddleware, getVideoAnalytics);
router.post('/video/:id/like', authMiddleware, likeVideoDashboard);

export default router;
