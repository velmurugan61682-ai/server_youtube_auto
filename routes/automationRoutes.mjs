import express from 'express';
import { 
  getAutomationSettings, 
  updateAutomationSettings 
} from '../controllers/automationController.mjs';
import { authMiddleware } from '../middleware/auth.mjs';

const router = express.Router();

// GET /api/automation/settings
router.get('/settings', authMiddleware, getAutomationSettings);

// PUT /api/automation/settings
router.put('/settings', authMiddleware, updateAutomationSettings);

export default router;
