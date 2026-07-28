import express from 'express';
import { 
  getAutomationSettings, 
  updateAutomationSettings,
  triggerSync
} from '../controllers/automationController.mjs';
import { authMiddleware } from '../middleware/auth.mjs';

const router = express.Router();

// GET /api/automation/settings
router.get('/settings', authMiddleware, getAutomationSettings);

// PUT /api/automation/settings
router.put('/settings', authMiddleware, updateAutomationSettings);

// POST /api/automation/settings (backward compatibility)
router.post('/settings', authMiddleware, updateAutomationSettings);

// POST /api/automation/trigger-sync
router.post('/trigger-sync', authMiddleware, triggerSync);

export default router;
