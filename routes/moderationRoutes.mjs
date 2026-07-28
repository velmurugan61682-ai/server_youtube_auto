import express from 'express';
import { authMiddleware } from '../middleware/auth.mjs';
import { 
  getModerationRules, 
  updateModerationRules, 
  getModeratedComments,
  getModerationLogs
} from '../controllers/moderationController.mjs';

const router = express.Router();

router.get('/rules', authMiddleware, getModerationRules);
router.put('/rules', authMiddleware, updateModerationRules);
router.post('/rules', authMiddleware, updateModerationRules);
router.get('/logs', authMiddleware, getModerationLogs);
router.get('/comments', authMiddleware, getModeratedComments);

export default router;

