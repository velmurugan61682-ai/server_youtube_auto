import express from 'express';
import { 
  getConnectedChannels, 
  connectChannel, 
  disconnectChannel 
} from '../controllers/channelController.mjs';
import { authMiddleware } from '../middleware/auth.mjs';
import { requireActiveSubscription, checkChannelLimit } from '../middleware/subscription.mjs';

const router = express.Router();

// GET /api/channels
router.get('/', authMiddleware, getConnectedChannels);

// POST /api/channels/connect
router.post('/connect', authMiddleware, requireActiveSubscription, checkChannelLimit, connectChannel);

// DELETE /api/channels/:id
router.delete('/:id', authMiddleware, disconnectChannel);

export default router;
