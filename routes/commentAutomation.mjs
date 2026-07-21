import express from 'express';
import mongoose from 'mongoose';
import { authMiddleware } from '../middleware/auth.mjs';
import { createRule, getRules, updateRule, deleteRule } from '../controllers/commentController.mjs';
import CommentAutomationRule from '../models/CommentAutomationRule.mjs';
import CommentAutomationLog from '../models/CommentAutomationLog.mjs';
import AutoReplyRule from '../models/AutoReplyRule.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import Channel from '../models/Channel.mjs';
import Video from '../models/Video.mjs';
import { getYouTubeClient, replyToComment, deleteCommentFromYouTube, hideComment } from '../services/youtubeService.mjs';
import logger from '../utils/logger.mjs';
import { decrypt, encrypt } from '../utils/cryptoHelper.mjs';
import { google } from 'googleapis';

const router = express.Router();

// Helper to verify channel ownership
const verifyChannelAccess = async (channelId, user) => {
  const filter = user.organizationId 
    ? { channelId, $or: [{ organizationId: user.organizationId }, { userId: user.id }] }
    : { channelId, userId: user.id };
  const channel = await Channel.findOne(filter);
  return !!channel;
};

// Helper to verify video ownership
const verifyVideoAccess = async (videoId, user) => {
  const filter = user.organizationId
    ? { videoId, $or: [{ organizationId: user.organizationId }, { userId: user.id }] }
    : { videoId, userId: user.id };
  const video = await Video.findOne(filter);
  if (video) return true;

  const dbVideo = await Video.findOne({ videoId });
  if (!dbVideo) return false;
  return await verifyChannelAccess(dbVideo.channelId, user);
};

// Helper to get OAuth2 Youtube client for a channel
const getYoutubeClientForChannel = async (channelId, user) => {
  const filter = user.organizationId
    ? { channelId, $or: [{ organizationId: user.organizationId }, { userId: user.id }] }
    : { channelId, userId: user.id };
  const channel = await Channel.findOne(filter);
  if (!channel) throw new Error('Channel not found or unauthorized');

  if (channel.apiKey) {
    return google.youtube({ version: 'v3', auth: decrypt(channel.apiKey) });
  }

  const oauth2Client = getYouTubeClient({
    access_token: decrypt(channel.accessToken),
    refresh_token: decrypt(channel.refreshToken),
    expiry_date: channel.expiryDate
  }, async (newTokens) => {
    logger.info(`[Comment Automation API] Tokens refreshed for channel ${channelId}`);
    await Channel.findOneAndUpdate({
      _id: channel._id
    }, {
      accessToken: encrypt(newTokens.access_token),
      refreshToken: encrypt(newTokens.refresh_token || decrypt(channel.refreshToken)),
      expiryDate: newTokens.expiry_date
    });
  }, channel._id);

  return oauth2Client;
};

// Direct CRUD routes wired to commentController.mjs
router.post('/rule', authMiddleware, createRule);
router.post('/rules', authMiddleware, createRule);
router.get('/rules', authMiddleware, getRules);
router.put('/rule/:ruleId', authMiddleware, updateRule);
router.put('/rules/:id', authMiddleware, updateRule);
router.patch('/rules/:id', authMiddleware, updateRule);
router.delete('/rule/:ruleId', authMiddleware, deleteRule);
router.delete('/rules/:id', authMiddleware, deleteRule);

/**
 * @route POST /api/comment-automation/rules
 * @desc Create a new automation rule
 * @access Private
 */
router.post('/rules', authMiddleware, async (req, res) => {
  try {
    const {
      channelId,
      videoId,
      applyToAllVideos,
      name,
      triggerType,
      keywords,
      publicReplyEnabled,
      replyTemplates,
      templateSelectionMode,
      aiReplyEnabled,
      aiTone,
      customTone,
      maxReplyLength,
      status
    } = req.body;

    if (!channelId || !triggerType || !name) {
      return res.status(400).json({ error: 'channelId, triggerType, and name are required' });
    }

    // Verify channel ownership
    const hasChannel = await verifyChannelAccess(channelId, req.user);
    if (!hasChannel) {
      return res.status(403).json({ error: 'Access denied: You do not own this channel.' });
    }

    // Verify video ownership if not applying to all
    if (!applyToAllVideos && videoId) {
      const hasVideo = await verifyVideoAccess(videoId, req.user);
      if (!hasVideo) {
        return res.status(403).json({ error: 'Access denied: You do not own this video.' });
      }
    }

    // Sanitize keywords (Tamil, English)
    const sanitizedKeywords = (keywords || [])
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);

    const rule = new CommentAutomationRule({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      channelId,
      videoId: applyToAllVideos ? null : videoId,
      applyToAllVideos: !!applyToAllVideos,
      name,
      triggerType,
      keywords: sanitizedKeywords,
      publicReplyEnabled: publicReplyEnabled !== false,
      replyTemplates: replyTemplates || [],
      templateSelectionMode: templateSelectionMode || 'random',
      aiReplyEnabled: !!aiReplyEnabled,
      aiTone: aiTone || 'Friendly',
      customTone: customTone || '',
      maxReplyLength: maxReplyLength || 200,
      status: status || 'Active'
    });

    await rule.save();
    return res.status(201).json(rule);
  } catch (error) {
    logger.error(`[Comment Automation Route] Error creating rule: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/comment-automation/rules/:id
 * @desc Get a specific automation rule details
 * @access Private
 */
router.get('/rules/:id', authMiddleware, async (req, res) => {
  try {
    const rule = await CommentAutomationRule.findOne({
      _id: req.params.id,
      userId: req.user.id,
      organizationId: req.user.organizationId
    });
    if (!rule) {
      return res.status(404).json({ error: 'Automation rule not found' });
    }
    return res.json(rule);
  } catch (error) {
    logger.error(`[Comment Automation Route] Error fetching rule details: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route PATCH /api/comment-automation/rules/:id
 * @desc Update an automation rule
 * @access Private
 */
router.patch('/rules/:id', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      triggerType,
      keywords,
      publicReplyEnabled,
      replyTemplates,
      templateSelectionMode,
      aiReplyEnabled,
      aiTone,
      customTone,
      maxReplyLength,
      status,
      videoId,
      applyToAllVideos
    } = req.body;

    const rule = await CommentAutomationRule.findOne({
      _id: req.params.id,
      userId: req.user.id,
      organizationId: req.user.organizationId
    });
    if (!rule) {
      return res.status(404).json({ error: 'Automation rule not found' });
    }

    if (name) rule.name = name;
    if (triggerType) rule.triggerType = triggerType;
    if (keywords) {
      rule.keywords = keywords.map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
    }
    if (publicReplyEnabled !== undefined) rule.publicReplyEnabled = !!publicReplyEnabled;
    if (replyTemplates) rule.replyTemplates = replyTemplates;
    if (templateSelectionMode) rule.templateSelectionMode = templateSelectionMode;
    if (aiReplyEnabled !== undefined) rule.aiReplyEnabled = !!aiReplyEnabled;
    if (aiTone) rule.aiTone = aiTone;
    if (customTone !== undefined) rule.customTone = customTone;
    if (maxReplyLength) rule.maxReplyLength = maxReplyLength;
    if (status) rule.status = status;
    
    if (applyToAllVideos !== undefined) {
      rule.applyToAllVideos = !!applyToAllVideos;
      if (rule.applyToAllVideos) {
        rule.videoId = null;
      } else if (videoId) {
        rule.videoId = videoId;
      }
    } else if (videoId) {
      rule.videoId = videoId;
    }

    await rule.save();
    return res.json(rule);
  } catch (error) {
    logger.error(`[Comment Automation Route] Error updating rule: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route DELETE /api/comment-automation/rules/:id
 * @desc Delete an automation rule
 * @access Private
 */
router.delete('/rules/:id', authMiddleware, async (req, res) => {
  try {
    const rule = await CommentAutomationRule.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
      organizationId: req.user.organizationId
    });
    if (!rule) {
      return res.status(404).json({ error: 'Automation rule not found' });
    }
    return res.json({ success: true, message: 'Rule successfully deleted' });
  } catch (error) {
    logger.error(`[Comment Automation Route] Error deleting rule: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route PATCH /api/comment-automation/rules/:id/status
 * @desc Pause or Enable an automation rule
 * @access Private
 */
router.patch('/rules/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['Active', 'Paused'].includes(status)) {
      return res.status(400).json({ error: 'Valid status (Active or Paused) is required' });
    }

    const rule = await CommentAutomationRule.findOne({
      _id: req.params.id,
      userId: req.user.id,
      organizationId: req.user.organizationId
    });
    if (!rule) {
      return res.status(404).json({ error: 'Automation rule not found' });
    }

    rule.status = status;
    await rule.save();
    return res.json(rule);
  } catch (error) {
    logger.error(`[Comment Automation Route] Error toggling status: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/comment-automation/rules/:id/test
 * @desc Simulates comment automation rule match and reply generation without posting on YouTube
 * @access Private
 */
router.post('/rules/:id/test', authMiddleware, async (req, res) => {
  try {
    const { commentText } = req.body;
    if (!commentText) {
      return res.status(400).json({ error: 'commentText is required for testing' });
    }

    const rule = await CommentAutomationRule.findOne({
      _id: req.params.id,
      userId: req.user.id,
      organizationId: req.user.organizationId
    });
    if (!rule) {
      return res.status(404).json({ error: 'Automation rule not found' });
    }

    const textLower = commentText.toLowerCase().trim();
    let matched = false;
    let matchedKeyword = null;

    // Check Trigger Match
    if (rule.triggerType === 'any_comment') {
      matched = true;
    } else if (rule.triggerType === 'contains_any') {
      matchedKeyword = rule.keywords.find(kw => textLower.includes(kw));
      matched = !!matchedKeyword;
    } else if (rule.triggerType === 'contains_all') {
      matched = rule.keywords.every(kw => textLower.includes(kw));
      if (matched) matchedKeyword = rule.keywords.join(', ');
    } else if (rule.triggerType === 'exact_match') {
      matchedKeyword = rule.keywords.find(kw => textLower === kw);
      matched = !!matchedKeyword;
    } else if (rule.triggerType === 'ai_intent') {
      // Direct intent simulation
      matched = textLower.length > 5; // Simple heuristic for mock test
      matchedKeyword = 'AI Intent Detected';
    }

    if (!matched) {
      return res.json({
        matched: false,
        explanation: 'Comment did not trigger rule. Criteria not met.'
      });
    }

    // Run Mock Moderation
    let category = 'Neutral';
    let toxicityScore = 0;
    let recommendedAction = 'published';

    // Quick local checks to avoid API latency during tests if possible
    if (textLower.includes('spam') || textLower.includes('abuse') || textLower.includes('fake')) {
      category = 'Toxic';
      toxicityScore = 0.9;
      recommendedAction = 'delete';
    }

    // Generate reply text
    let generatedReply = '';
    if (rule.publicReplyEnabled) {
      if (rule.aiReplyEnabled) {
        generatedReply = `[AI Reply in ${rule.aiTone} tone] Thanks for the feedback! We are glad you found it interesting.`;
      } else if (rule.replyTemplates.length > 0) {
        generatedReply = rule.replyTemplates[0]
          .replace('{{username}}', 'TestUser')
          .replace('{{channelName}}', 'MyChannel')
          .replace('{{videoTitle}}', 'Awesome YouTube Video')
          .replace('{{commentText}}', commentText);
      } else {
        generatedReply = 'Thank you for your comment!';
      }
    }

    if (rule.replyType === 'Carousel' && rule.carouselCards && rule.carouselCards.length > 0) {
      const cardsFormatted = rule.carouselCards.map(card => {
        return `Card:\nImage:\n${card.imageUrl || ''}\n\nTitle:\n${card.title || ''}\n\nDescription:\n${card.description || ''}\n\nButton:\n${card.btnLabel || card.buttonText || 'View Detail'}\n\nURL:\n${card.link || card.buttonUrl || ''}`;
      }).join('\n\n');
      generatedReply = cardsFormatted;
    }

    return res.json({
      matched: true,
      matchedKeyword,
      generatedReply,
      classification: category,
      moderationDecision: recommendedAction === 'delete' ? 'Delete Comment' : 'Approve Comment',
      explanation: `Successfully triggered "${rule.name}" via trigger type "${rule.triggerType}".`
    });
  } catch (error) {
    logger.error(`[Comment Automation Route] Error testing rule: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/comment-automation/history
 * @desc Get pagination history of comment automations
 * @access Private
 */
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { channelId, ruleId, videoId, status, search, page = 1, limit = 10 } = req.query;
    
    const query = {
      userId: req.user.id,
      organizationId: req.user.organizationId
    };
    if (channelId) {
      const hasChannel = await verifyChannelAccess(channelId, req.user);
      if (!hasChannel) return res.status(403).json({ error: 'Access denied: You do not own this channel.' });
      query.channelId = channelId;
    }
    if (ruleId) query.ruleId = ruleId;
    if (videoId) query.videoId = videoId;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { authorName: { $regex: search, $options: 'i' } },
        { commentText: { $regex: search, $options: 'i' } },
        { matchedKeyword: { $regex: search, $options: 'i' } }
      ];
    }

    const skipIndex = (parseInt(page) - 1) * parseInt(limit);
    const total = await CommentAutomationLog.countDocuments(query);
    
    const logs = await CommentAutomationLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skipIndex)
      .limit(parseInt(limit))
      .populate({ path: 'ruleId', select: 'name' })
      .lean();

    // Map logs to inject video details if missing
    const videoIds = [...new Set(logs.map(l => l.videoId))];
    const videos = await Video.find({ videoId: { $in: videoIds } }).select('videoId title thumbnail').lean();
    const videoMap = videos.reduce((acc, v) => {
      acc[v.videoId] = v;
      return acc;
    }, {});

    const enrichedLogs = logs.map(log => ({
      ...log,
      ruleName: log.ruleId?.name || 'Deleted Rule',
      videoTitle: videoMap[log.videoId]?.title || 'Unknown Video',
      videoThumbnail: videoMap[log.videoId]?.thumbnail || ''
    }));

    return res.json({
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: enrichedLogs
    });
  } catch (error) {
    logger.error(`[Comment Automation Route] Error fetching history: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/comment-automation/history/:id/retry
 * @desc Retry posting a failed comment automation reply
 * @access Private
 */
router.post('/history/:id/retry', authMiddleware, async (req, res) => {
  try {
    const log = await CommentAutomationLog.findOne({
      _id: req.params.id,
      userId: req.user.id,
      organizationId: req.user.organizationId
    });
    if (!log) {
      return res.status(404).json({ error: 'Automation log entry not found' });
    }

    if (log.status !== 'Failed') {
      return res.status(400).json({ error: 'Only failed logs can be retried.' });
    }

    log.status = 'Processing';
    log.attemptCount += 1;
    await log.save();

    let youtubeClient;
    try {
      youtubeClient = await getYoutubeClientForChannel(log.channelId, req.user);
    } catch (authError) {
      log.status = 'Failed';
      log.failureReason = `Auth Failure: ${authError.message}`;
      await log.save();
      return res.status(400).json({ error: log.failureReason });
    }

    // Verify parent comment is still present before replying
    const topLevelId = log.parentCommentId || log.commentId;
    let commentExists = false;
    try {
      const existsRes = await youtubeClient.comments.list({
        part: 'id',
        id: topLevelId
      });
      commentExists = existsRes.data.items && existsRes.data.items.length > 0;
    } catch (checkError) {
      logger.warn(`[Retry comment] Parent comment check failed: ${checkError.message}`);
    }

    if (!commentExists) {
      log.status = 'Failed';
      log.failureReason = 'The parent comment could not be found or was deleted.';
      await log.save();
      return res.status(404).json({ error: log.failureReason });
    }

    // Post reply on YouTube
    const repRes = await replyToComment(youtubeClient, topLevelId, log.generatedReply);
    if (repRes.success) {
      log.status = 'Replied';
      log.replyId = repRes.newCommentId;
      log.processedAt = new Date();
      log.failureReason = null;
      await log.save();

      // Update counters in Rule
      await CommentAutomationRule.updateOne(
        { _id: log.ruleId },
        { 
          $inc: { successfulReplyCount: 1 },
          $set: { lastTriggeredAt: new Date() }
        }
      );

      return res.json({ success: true, message: 'Reply posted successfully!' });
    } else {
      log.status = 'Failed';
      log.failureReason = repRes.reason || 'Failed to post reply';
      await log.save();

      // Update failed counters in Rule
      await CommentAutomationRule.updateOne(
        { _id: log.ruleId },
        { $inc: { failedReplyCount: 1 } }
      );

      return res.status(400).json({ error: log.failureReason });
    }
  } catch (error) {
    logger.error(`[Comment Automation Route] Error retrying reply: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/comment-automation/moderation
 * @desc Get paginated moderation logs list
 * @access Private
 */
router.get('/moderation', authMiddleware, async (req, res) => {
  try {
    const { channelId, videoId, status, category, search, page = 1, limit = 10 } = req.query;
    
    const query = {
      userId: req.user.id,
      organizationId: req.user.organizationId
    };
    if (channelId) {
      const hasChannel = await verifyChannelAccess(channelId, req.user);
      if (!hasChannel) return res.status(403).json({ error: 'Access denied: You do not own this channel.' });
      query.channelId = channelId;
    }
    if (videoId) query.videoId = videoId;
    if (status) query.status = status;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { commentId: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } }
      ];
    }

    const skipIndex = (parseInt(page) - 1) * parseInt(limit);
    const total = await ModerationLog.countDocuments(query);
    
    const logs = await ModerationLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skipIndex)
      .limit(parseInt(limit))
      .lean();

    // Enrich video details
    const videoIds = [...new Set(logs.map(l => l.videoId))];
    const videos = await Video.find({ videoId: { $in: videoIds } }).select('videoId title thumbnail').lean();
    const videoMap = videos.reduce((acc, v) => {
      acc[v.videoId] = v;
      return acc;
    }, {});

    const enrichedLogs = logs.map(log => ({
      ...log,
      videoTitle: videoMap[log.videoId]?.title || 'Unknown Video',
      videoThumbnail: videoMap[log.videoId]?.thumbnail || ''
    }));

    return res.json({
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: enrichedLogs
    });
  } catch (error) {
    logger.error(`[Comment Automation Route] Error fetching moderation logs: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/comment-automation/moderation/:id/action
 * @desc Executes moderation action manually on a comment
 * @access Private
 */
router.post('/moderation/:id/action', authMiddleware, async (req, res) => {
  try {
    const { action } = req.body; // e.g. delete, spam, published, rejected, hold
    if (!action || !['delete', 'spam', 'published', 'rejected', 'hold'].includes(action)) {
      return res.status(400).json({ error: 'Valid moderation action is required' });
    }

    const log = await ModerationLog.findOne({
      _id: req.params.id,
      userId: req.user.id,
      organizationId: req.user.organizationId
    });
    if (!log) {
      return res.status(404).json({ error: 'Moderation log entry not found' });
    }

    let youtubeClient;
    try {
      youtubeClient = await getYoutubeClientForChannel(log.channelId, req.user);
    } catch (authError) {
      return res.status(400).json({ error: `Auth Error: ${authError.message}` });
    }

    if (action === 'delete') {
      const delRes = await deleteCommentFromYouTube(youtubeClient, log.commentId);
      if (delRes.success) {
        log.executedAction = 'delete';
        log.status = 'Success';
        await log.save();
        return res.json({ success: true, message: 'Comment deleted successfully' });
      } else {
        log.status = 'Failed';
        log.failureReason = delRes.reason || 'Failed to delete comment';
        await log.save();
        return res.status(400).json({ error: log.failureReason });
      }
    } else if (action === 'spam' || action === 'rejected') {
      try {
        await youtubeClient.comments.setModerationStatus({
          id: [log.commentId],
          moderationStatus: action === 'spam' ? 'spam' : 'rejected'
        });
        log.executedAction = action;
        log.status = 'Success';
        await log.save();
        return res.json({ success: true, message: `Comment marked as ${action}` });
      } catch (err) {
        log.status = 'Failed';
        log.failureReason = err.message;
        await log.save();
        return res.status(400).json({ error: err.message });
      }
    } else if (action === 'published') {
      try {
        await youtubeClient.comments.setModerationStatus({
          id: [log.commentId],
          moderationStatus: 'published'
        });
        log.executedAction = 'published';
        log.status = 'Success';
        await log.save();
        return res.json({ success: true, message: 'Comment approved and published' });
      } catch (err) {
        log.status = 'Failed';
        log.failureReason = err.message;
        await log.save();
        return res.status(400).json({ error: err.message });
      }
    } else if (action === 'hold') {
      const hideRes = await hideComment(youtubeClient, log.commentId);
      if (hideRes.success) {
        log.executedAction = 'hold';
        log.status = 'Success';
        await log.save();
        return res.json({ success: true, message: 'Comment held for review' });
      } else {
        log.status = 'Failed';
        log.failureReason = hideRes.reason || 'Failed to hold comment';
        await log.save();
        return res.status(400).json({ error: log.failureReason });
      }
    }

    return res.status(400).json({ error: 'Action not supported yet' });
  } catch (error) {
    logger.error(`[Comment Automation Route] Error executing moderation: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/comment-automation/stats
 * @desc Get overview moderation and comment automation stats
 * @access Private
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { channelId } = req.query;
    const query = {
      userId: req.user.id
    };
    if (channelId) {
      const hasChannel = await verifyChannelAccess(channelId, req.user);
      if (!hasChannel) return res.status(403).json({ error: 'Access denied: You do not own this channel.' });
      query.channelId = channelId;
    }

    const totalRules = await AutoReplyRule.countDocuments(query);
    const totalTriggers = await AutoReplyLog.countDocuments(query);
    const totalSuccess = await AutoReplyLog.countDocuments({ ...query, status: 'success' });
    const totalFailed = await AutoReplyLog.countDocuments({ ...query, status: 'failed' });

    // Moderation counters
    const totalModerated = await ModerationLog.countDocuments({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      ...(channelId ? { channelId } : {})
    });
    const deletedCount = await ModerationLog.countDocuments({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      ...(channelId ? { channelId } : {}),
      executedAction: 'delete'
    });
    const heldCount = await ModerationLog.countDocuments({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      ...(channelId ? { channelId } : {}),
      executedAction: 'hold'
    });
    const approvedCount = await ModerationLog.countDocuments({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      ...(channelId ? { channelId } : {}),
      executedAction: 'published'
    });
    const spamCount = await ModerationLog.countDocuments({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      ...(channelId ? { channelId } : {}),
      category: 'spam'
    });

    // Average Toxicity calculation
    const avgToxResult = await ModerationLog.aggregate([
      { $match: {
        userId: new mongoose.Types.ObjectId(req.user.id),
        ...(channelId ? { channelId } : {})
      } },
      { $group: { _id: null, avgTox: { $avg: '$toxicityScore' } } }
    ]);

    return res.json({
      totalRules,
      totalTriggers,
      totalSuccess,
      totalFailed,
      totalModerated,
      deleted: deletedCount,
      heldForReview: heldCount,
      approved: approvedCount,
      spamDetected: spamCount,
      averageToxicity: Math.round((avgToxResult[0]?.avgTox || 0) * 100) // format as percentage
    });
  } catch (error) {
    logger.error(`[Comment Automation Route] Error fetching stats: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
