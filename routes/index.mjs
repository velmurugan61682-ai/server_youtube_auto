import express from 'express';
import authRoutes from './authRoutes.mjs';
import youtubeRoutes from './youtubeRoutes.mjs';
import commentRoutes from './commentRoutes.mjs';
import analyticsRoutes from './analyticsRoutes.mjs';
import leadRoutes from './leadRoutes.mjs';
import settingsRoutes from './settingsRoutes.mjs';
import automationRoutes from './automation.js';
import autoDmRoutes from './autoDm.js';
import subscriptionRoutes from './subscriptionRoutes.mjs';
import { requireActiveSubscription } from '../middleware/subscription.mjs';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/subscription', subscriptionRoutes);

// Core feature routes (accessible by both Free and Premium users)
router.use('/youtube', youtubeRoutes);
router.use('/comments', commentRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/leads', leadRoutes);
router.use('/settings', settingsRoutes);
router.use('/automation', automationRoutes);
router.use('/auto-dm', autoDmRoutes);

export default router;
