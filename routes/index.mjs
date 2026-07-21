import express from 'express';
import authRoutes from './authRoutes.mjs';
import youtubeRoutes from './youtubeRoutes.mjs';
import channelRoutes from './channelRoutes.mjs';
import commentRoutes from './commentRoutes.mjs';
import analyticsRoutes from './analyticsRoutes.mjs';
import leadRoutes from './leadRoutes.mjs';
import settingsRoutes from './settingsRoutes.mjs';
import legacyAutomationRoutes from './automation.js';
import automationRoutes from './automationRoutes.mjs';
import commentAutomationRoutes from './commentAutomation.mjs';
import autoModRoutes from './autoModRoutes.mjs';
import subscriptionRoutes from './subscriptionRoutes.mjs';
import billingRoutes from './billingRoutes.mjs';
import moderationRoutes from './moderationRoutes.mjs';
import apiKeyRoutes from './apiKeyRoutes.mjs';
import liveChatRoutes from './liveChat.mjs';
import adminRoutes from './adminRoutes.mjs';
import adminModerationRoutes from './adminModerationRoutes.mjs';
import externalRoutes from './externalRoutes.mjs';
import dashboardRoutes from './dashboardRoutes.mjs';
import commentHistoryRoutes from './commentHistoryRoutes.mjs';

const router = express.Router();

// SaaS Rest API Architecture Routes
router.use('/auth', authRoutes);
router.use('/channels', channelRoutes);
router.use('/comments', commentRoutes);
router.use('/automation', automationRoutes);
router.use('/moderation', moderationRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/billing', billingRoutes);
router.use('/api-keys', apiKeyRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/comment-history', commentHistoryRoutes);

// Legacy & Supporting routes (for full backward compatibility)
router.use('/youtube', youtubeRoutes);
router.use('/leads', leadRoutes);
router.use('/settings', settingsRoutes);
router.use('/legacy-automation', legacyAutomationRoutes);
router.use('/comment-automation', commentAutomationRoutes);
router.use('/auto-mod', autoModRoutes);
router.use('/live-chat', liveChatRoutes);

// Console Admin and Integration API routes
router.use('/v1/admin/moderation', adminModerationRoutes);
router.use('/v1/admin', adminRoutes);
router.use('/admin/moderation', adminModerationRoutes);
router.use('/admin', adminRoutes);
router.use('/external', externalRoutes);

export default router;

