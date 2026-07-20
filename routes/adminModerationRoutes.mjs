import express from 'express';
import { requireAdminRole } from '../middleware/requireAdminRole.mjs';
import { getAdminModerationStats } from '../controllers/adminModerationController.mjs';

const router = express.Router();

// Admin-only route: aggregate stats across ALL organizations
router.get('/stats', requireAdminRole, getAdminModerationStats);

export default router;
