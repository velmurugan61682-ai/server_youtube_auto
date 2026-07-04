import express from 'express';
import { authMiddleware } from '../middleware/auth.mjs';
import AutoDmConfig from '../models/AutoDmConfig.js';
import RepliedComment from '../models/RepliedComment.js';
import { processVideo } from '../services/autoDmService.js';
import logger from '../utils/logger.mjs';
import Video from '../models/Video.mjs';

// NOTE: Auto DM cron is initialized from index.mjs after MongoDB connects.
// Do NOT import '../jobs/autoDmCron.js' here — it caused side-effect initialization.

const router = express.Router();

/**
 * @route GET /api/auto-dm/config/:videoId
 * @desc Get configuration for a specific video
 * @access Private
 */
router.get('/config/:videoId', authMiddleware, async (req, res) => {
  try {
    const { videoId } = req.params;
    const config = await AutoDmConfig.findOne({ videoId, userId: req.user.id });
    
    if (!config) {
      // Return default values so the frontend has fallback values
      return res.json({
        videoId,
        enabled: false,
        whatsappNumber: '',
        keywords: ['contact', 'details', 'course', 'help', 'info', 'price'],
        replyTemplates: [
          '📲 மேலும் தகவலுக்கு WhatsApp: {whatsapp_link}',
          '💬 Need details? Message me on WhatsApp: {whatsapp_link}',
          '📞 Contact on WhatsApp: {whatsapp_link}'
        ]
      });
    }

    return res.json(config);
  } catch (error) {
    logger.error(`[Auto DM Route] Error fetching config: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/auto-dm/config
 * @desc Create or update Auto DM configuration for a video
 * @access Private
 */
router.post('/config', authMiddleware, async (req, res) => {
  try {
    const { channelId, videoId, enabled, whatsappNumber, keywords, replyTemplates } = req.body;
    
    if (!channelId || !videoId || !whatsappNumber) {
      return res.status(400).json({ error: 'channelId, videoId, and whatsappNumber are required' });
    }

    // Validate: video must actually exist in DB to prevent ghost/placeholder configs
    const videoExists = await Video.exists({ videoId });
    if (!videoExists) {
      return res.status(400).json({ 
        error: `Video "${videoId}" does not exist in the database. Please select a valid video from your channel.` 
      });
    }

    const config = await AutoDmConfig.findOneAndUpdate(
      { videoId, userId: req.user.id },
      {
        channelId,
        videoId,
        enabled: !!enabled,
        whatsappNumber,
        keywords: keywords || [],
        replyTemplates: replyTemplates || [],
        userId: req.user.id
      },
      { upsert: true, new: true }
    );

    return res.json(config);
  } catch (error) {
    logger.error(`[Auto DM Route] Error updating config: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/auto-dm/stats/:videoId
 * @desc Get statistics for a specific video config
 * @access Private
 */
router.get('/stats/:videoId', authMiddleware, async (req, res) => {
  try {
    const { videoId } = req.params;
    const config = await AutoDmConfig.findOne({ videoId, userId: req.user.id });
    
    const totalReplies = await RepliedComment.countDocuments({ videoId, userId: req.user.id });

    // Mock pending comments to 0 since we reply near instantly
    const pendingComments = 0;
    
    return res.json({
      totalReplies,
      pendingComments,
      lastRunTime: config ? config.lastRunAt : null,
      status: config && config.enabled ? 'Active' : 'Paused'
    });
  } catch (error) {
    logger.error(`[Auto DM Route] Error fetching stats: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/auto-dm/history/:videoId?
 * @desc Get paginated reply history for a specific video
 * @access Private
 */
router.get('/history/:videoId?', authMiddleware, async (req, res) => {
  try {
    const videoId = req.params.videoId || req.query.videoId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { userId: req.user.id };
    if (videoId) {
      query.videoId = videoId;
    }

    const [history, total] = await Promise.all([
      RepliedComment.find(query)
        .sort({ repliedAt: -1 })
        .skip(skip)
        .limit(limit),
      RepliedComment.countDocuments(query)
    ]);

    return res.json({
      data: history,
      page,
      pages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    logger.error(`[Auto DM Route] Error fetching history: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/auto-dm/run/:videoId
 * @desc Manually trigger comments check & replies for a specific video
 * @access Private
 */
router.post('/run/:videoId', authMiddleware, async (req, res) => {
  try {
    const { videoId } = req.params;
    
    // Check config belongs to user
    const config = await AutoDmConfig.findOne({ videoId, userId: req.user.id });
    if (!config) {
      return res.status(404).json({ error: 'Auto DM config not found for this video' });
    }

    if (!config.enabled) {
      return res.status(400).json({ error: 'Auto DM is disabled. Please enable it first.' });
    }

    // Run the service
    const result = await processVideo(videoId);
    
    if (result.success) {
      return res.json({
        success: true,
        message: `Manual Auto DM processing completed. Sent ${result.repliesSent} replies.`
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.reason
      });
    }
  } catch (error) {
    logger.error(`[Auto DM Route] Error running manually: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
