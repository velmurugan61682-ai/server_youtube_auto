import User from '../models/User.mjs';
import AutoReplyRule from '../models/AutoReplyRule.mjs';
import logger from '../utils/logger.mjs';

/**
 * GET /api/automation/settings
 * Fetch automation settings, AI configuration, and active rules for user
 */
export const getAutomationSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('settings email').lean();
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const rulesFilter = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }] }
      : { userId: req.user.id };

    const rules = await AutoReplyRule.find(rulesFilter).sort({ createdAt: -1 }).lean();

    const settings = {
      autoMod: true,
      autoLike: true,
      confidenceThreshold: 85,
      languages: ['English', 'Tamil', 'Tanglish'],
      realTimeAlerts: true,
      leadKeywords: ['price', 'details', 'course', 'join', 'contact', 'phone', 'call', 'whatsapp', 'demo', 'fees'],
      ...(user.settings || {})
    };

    return res.json({
      success: true,
      data: {
        settings,
        rules
      }
    });
  } catch (error) {
    logger.error('Error in getAutomationSettings:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch automation settings' });
  }
};

/**
 * PUT /api/automation/settings
 * Update automation settings, AI parameters, and keywords
 */
export const updateAutomationSettings = async (req, res) => {
  try {
    const { autoMod, autoLike, confidenceThreshold, languages, realTimeAlerts, leadKeywords } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.settings) user.settings = {};

    if (autoMod !== undefined) user.settings.autoMod = Boolean(autoMod);
    if (autoLike !== undefined) user.settings.autoLike = Boolean(autoLike);
    if (confidenceThreshold !== undefined) user.settings.confidenceThreshold = Number(confidenceThreshold);
    if (languages !== undefined && Array.isArray(languages)) user.settings.languages = languages;
    if (realTimeAlerts !== undefined) user.settings.realTimeAlerts = Boolean(realTimeAlerts);
    if (leadKeywords !== undefined && Array.isArray(leadKeywords)) {
      user.settings.leadKeywords = [...new Set(leadKeywords.map(k => String(k).trim()).filter(Boolean))];
    }

    user.markModified('settings');
    await user.save();

    return res.json({
      success: true,
      message: 'Automation settings updated successfully',
      data: user.settings
    });
  } catch (error) {
    logger.error('Error in updateAutomationSettings:', error);
    return res.status(500).json({ success: false, error: 'Failed to update automation settings' });
  }
};

/**
 * POST /api/automation/trigger-sync
 * Trigger real-time comment synchronization for user's connected channel
 */
export const triggerSync = async (req, res) => {
  try {
    const Channel = (await import('../models/Channel.mjs')).default;
    const channel = await Channel.findOne({ userId: req.user.id, status: 'connected' }).lean();

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'No connected YouTube channel found'
      });
    }

    // Trigger sync asynchronously in background
    import('../jobs/youtubeCommentWorker.mjs')
      .then(worker => worker.runYouTubeCommentWorker(req.app.get('io')))
      .catch(err => logger.error('[Trigger Sync] Async worker error:', err));

    return res.status(202).json({
      success: true,
      message: 'Comment synchronization triggered successfully',
      channelId: channel.channelId
    });
  } catch (error) {
    logger.error('Error in triggerSync:', error);
    return res.status(500).json({ success: false, message: 'Failed to trigger synchronization' });
  }
};
