import express from 'express';
import { authMiddleware } from '../middleware/auth.mjs';
import AutoReplyRule from '../models/AutoReplyRule.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import Channel from '../models/Channel.mjs';
import Video from '../models/Video.mjs';

const router = express.Router();

// Helper to verify channel ownership
const verifyChannelAccess = async (channelId, user) => {
  const filter = user.organizationId 
    ? { channelId, $or: [{ organizationId: user.organizationId }, { userId: user.id }] }
    : { channelId, userId: user.id };
  const channel = await Channel.findOne(filter);
  return !!channel;
};

/**
 * @route POST /api/auto-mod/rules
 * @desc Create a new auto reply rule
 * @access Private
 */
router.post('/rules', authMiddleware, async (req, res) => {
  try {
    const channelId = req.body.channelId;
    if (!channelId) {
      return res.status(400).json({ success: false, error: 'Channel ID is required' });
    }

    const hasChannel = await verifyChannelAccess(channelId, req.user);
    if (!hasChannel) {
      return res.status(403).json({ success: false, error: 'Access denied: Channel not connected or unauthorized' });
    }

    // Map incoming frontend properties to the database schema
    const name = req.body.name || 'Untitled Rule';
    const videoIds = req.body.videoIds || (req.body.videoId ? [req.body.videoId] : []);
    const contentType = req.body.contentType || (req.body.applyToAllVideos ? 'all' : 'video');
    const triggerKeywords = req.body.triggerKeywords || req.body.keywords || [];
    const matchType = req.body.matchType || req.body.triggerType || 'contains_any';
    const replyType = req.body.replyType || 'Text';
    const replyText = req.body.replyText || req.body.replyCommentText || '';
    const carouselCards = Array.isArray(req.body.carouselCards) ? req.body.carouselCards.map(c => ({
        imageUrl: c.imageUrl || '',
        title: c.title || '',
        description: c.description || '',
        btnLabel: c.btnLabel || c.buttonText || 'View Detail',
        buttonText: c.buttonText || c.btnLabel || 'View Detail',
        link: c.link || c.buttonUrl || '',
        buttonUrl: c.buttonUrl || c.link || ''
    })) : [];
    const subscribersOnly = req.body.subscribersOnly !== undefined ? req.body.subscribersOnly : (req.body.followersOnly !== undefined ? req.body.followersOnly : false);
    const isActive = req.body.isActive !== undefined ? req.body.isActive : (req.body.status !== undefined ? req.body.status === 'Active' : true);
    const dmContent = req.body.dmContent !== undefined ? req.body.dmContent : (req.body.automatedDmContent || '');

    const rule = new AutoReplyRule({
      name,
      userId: req.user.id,
      organizationId: req.user.organizationId,
      channelId,
      videoIds,
      contentType,
      triggerKeywords,
      matchType,
      replyType,
      replyText,
      dmContent,
      carouselCards,
      subscribersOnly,
      isActive
    });

    await rule.save();

    return res.json({
      success: true,
      message: 'Automation deployed successfully',
      data: rule
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/auto-mod/rules
 * @desc List all auto reply rules for a channel
 * @access Private
 */
router.get('/rules', authMiddleware, async (req, res) => {
  try {
    const { channelId } = req.query;
    const query = { userId: req.user.id };
    if (channelId) {
      query.channelId = channelId;
    }
    const rules = await AutoReplyRule.find(query).sort({ createdAt: -1 });
    
    // Map database properties back to frontend properties
    const mappedRules = [];
    for (const rule of rules) {
      const videoId = rule.videoIds && rule.videoIds.length > 0 ? rule.videoIds[0] : null;
      // Get triggered count for this rule
      const count = await AutoReplyLog.countDocuments({
        channelId: rule.channelId,
        triggerKeyword: { $in: rule.triggerKeywords }
      });

      mappedRules.push({
        _id: rule._id,
        name: rule.name || 'Untitled Rule',
        channelId: rule.channelId,
        videoId: videoId,
        applyToAllVideos: rule.contentType === 'all',
        triggerType: rule.matchType,
        keywords: rule.triggerKeywords,
        replyType: rule.replyType,
        followersOnly: rule.subscribersOnly,
        replyCommentText: rule.replyText,
        automatedDmContent: rule.dmContent,
        carouselCards: rule.carouselCards || [],
        status: rule.isActive ? 'Active' : 'Paused',
        triggeredCount: count,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt
      });
    }

    return res.json(mappedRules);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route PATCH /api/auto-mod/rules/:id
 * @desc Update an auto reply rule
 * @access Private
 */
router.patch('/rules/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await AutoReplyRule.findOne({ _id: id, userId: req.user.id });
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    // Map incoming updates
    if (req.body.name !== undefined) rule.name = req.body.name;
    if (req.body.videoIds !== undefined) rule.videoIds = req.body.videoIds;
    else if (req.body.videoId !== undefined) rule.videoIds = [req.body.videoId];
    
    if (req.body.contentType !== undefined) rule.contentType = req.body.contentType;
    else if (req.body.applyToAllVideos !== undefined) rule.contentType = req.body.applyToAllVideos ? 'all' : 'video';
    
    if (req.body.triggerKeywords !== undefined) rule.triggerKeywords = req.body.triggerKeywords;
    else if (req.body.keywords !== undefined) rule.triggerKeywords = req.body.keywords;
    
    if (req.body.matchType !== undefined) rule.matchType = req.body.matchType;
    else if (req.body.triggerType !== undefined) rule.matchType = req.body.triggerType;
    
    if (req.body.replyType !== undefined) rule.replyType = req.body.replyType;
    if (req.body.replyText !== undefined) rule.replyText = req.body.replyText;
    else if (req.body.replyCommentText !== undefined) rule.replyText = req.body.replyCommentText;
    
    if (req.body.dmContent !== undefined) rule.dmContent = req.body.dmContent;
    else if (req.body.automatedDmContent !== undefined) rule.dmContent = req.body.automatedDmContent;

    if (req.body.carouselCards !== undefined && Array.isArray(req.body.carouselCards)) {
      rule.carouselCards = req.body.carouselCards.map(c => ({
        imageUrl: c.imageUrl || '',
        title: c.title || '',
        description: c.description || '',
        btnLabel: c.btnLabel || c.buttonText || 'View Detail',
        buttonText: c.buttonText || c.btnLabel || 'View Detail',
        link: c.link || c.buttonUrl || '',
        buttonUrl: c.buttonUrl || c.link || ''
      }));
    }
    
    if (req.body.subscribersOnly !== undefined) rule.subscribersOnly = req.body.subscribersOnly;
    else if (req.body.followersOnly !== undefined) rule.subscribersOnly = req.body.followersOnly;
    
    if (req.body.isActive !== undefined) rule.isActive = req.body.isActive;
    else if (req.body.status !== undefined) rule.isActive = req.body.status === 'Active';

    await rule.save();

    const videoId = rule.videoIds && rule.videoIds.length > 0 ? rule.videoIds[0] : null;
    const count = await AutoReplyLog.countDocuments({
      channelId: rule.channelId,
      triggerKeyword: { $in: rule.triggerKeywords }
    });

    const mappedRule = {
      _id: rule._id,
      name: rule.name || 'Untitled Rule',
      channelId: rule.channelId,
      videoId: videoId,
      applyToAllVideos: rule.contentType === 'all',
      triggerType: rule.matchType,
      keywords: rule.triggerKeywords,
      replyType: rule.replyType,
      followersOnly: rule.subscribersOnly,
      replyCommentText: rule.replyText,
      automatedDmContent: rule.dmContent,
      carouselCards: rule.carouselCards || [],
      status: rule.isActive ? 'Active' : 'Paused',
      triggeredCount: count,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt
    };

    return res.json(mappedRule);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route DELETE /api/auto-mod/rules/:id
 * @desc Delete an auto reply rule
 * @access Private
 */
router.delete('/rules/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await AutoReplyRule.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    return res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route PATCH /api/auto-mod/rules/:id/status
 * @desc Toggle rule active/paused state
 * @access Private
 */
router.patch('/rules/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Active' or 'Paused'
    
    const rule = await AutoReplyRule.findOne({ _id: id, userId: req.user.id });
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    rule.isActive = (status === 'Active');
    await rule.save();

    return res.json({ success: true, message: `Rule status updated to ${status}` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/auto-mod/comments
 * @desc Get real comments from AutoReplyLog for Comment Chat tab
 * @access Private
 */
router.get('/comments', authMiddleware, async (req, res) => {
  try {
    const { channelId } = req.query;
    if (!channelId) {
      return res.status(400).json({ success: false, error: 'Channel ID is required' });
    }

    const query = {
      userId: req.user.id,
      channelId
    };

    const logs = await AutoReplyLog.find(query).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/auto-mod/history
 * @desc Get real reply logs for Comment History tab
 * @access Private
 */
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { channelId, page = 1, limit = 10, search, status } = req.query;
    
    const query = {
      userId: req.user.id
    };
    if (channelId) {
      query.channelId = channelId;
    }
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { commentText: { $regex: search, $options: 'i' } },
        { replyText: { $regex: search, $options: 'i' } }
      ];
    }

    // Counters for the channel
    const totalReplies = await AutoReplyLog.countDocuments({ userId: req.user.id, ...(channelId ? { channelId } : {}) });
    const successfulReplies = await AutoReplyLog.countDocuments({ userId: req.user.id, ...(channelId ? { channelId } : {}), status: 'success' });
    const failedReplies = await AutoReplyLog.countDocuments({ userId: req.user.id, ...(channelId ? { channelId } : {}), status: 'failed' });

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const logs = await AutoReplyLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Resolve Video Names
    const videoIds = logs.map(l => l.videoId).filter(Boolean);
    const videos = await Video.find({ videoId: { $in: videoIds } });
    const videoMap = {};
    videos.forEach(v => {
      videoMap[v.videoId] = v.title;
    });

    const logsWithVideoName = logs.map(l => {
      const logObj = l.toObject();
      logObj.videoName = videoMap[l.videoId] || 'Unknown Video';
      return logObj;
    });

    return res.json({
      success: true,
      totalReplies,
      successfulReplies,
      failedReplies,
      total: await AutoReplyLog.countDocuments(query),
      pages: Math.ceil(await AutoReplyLog.countDocuments(query) / parseInt(limit)),
      page: parseInt(page),
      data: logsWithVideoName
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
