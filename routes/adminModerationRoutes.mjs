import express from 'express';
import { adminAuth } from '../middleware/adminAuth.mjs';
import { getAdminModerationStats } from '../controllers/adminModerationController.mjs';

const router = express.Router();

// Admin-only route: aggregate stats across ALL organizations
router.get('/stats', adminAuth, getAdminModerationStats);

export default router;
