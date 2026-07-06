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

    // FIX #4: Sanitize reply templates — replace any hardcoded {https://...} or {http://...}
    // URL-in-braces patterns with the correct {whatsapp_link} placeholder.
    // This fixes the broken WhatsApp link / %7D encoding issue.
    const HARDCODED_URL_IN_BRACES_ROUTE = /\{https?:\/\/[^}]*\}/g;
    const sanitizedTemplates = (replyTemplates || []).map((tpl) => {
      if (typeof tpl !== 'string') return tpl;
      const fixed = tpl.replace(HARDCODED_URL_IN_BRACES_ROUTE, '{whatsapp_link}');
      if (fixed !== tpl) {
        console.log(`[Fix #4] Auto-corrected malformed template in autoDm.js POST /config: "${tpl}" → "${fixed}"`);
      }
      return fixed;
    });
    // END FIX #4

    const config = await AutoDmConfig.findOneAndUpdate(
      { videoId, userId: req.user.id },
      {
        channelId,
        videoId,
        enabled: !!enabled,
        whatsappNumber,
        keywords: keywords || [],
        replyTemplates: sanitizedTemplates,
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

/**
 * @route POST /api/auto-dm/keywords/add
 * @desc FIX #5 — Atomically add a single keyword to the config using $addToSet
 *       (prevents duplicates, never overwrites existing keywords)
 * @access Private
 */
router.post('/keywords/add', authMiddleware, async (req, res) => {
  try {
    const { videoId, keyword } = req.body;
    if (!videoId || !keyword || typeof keyword !== 'string' || !keyword.trim()) {
      return res.status(400).json({ error: 'videoId and a non-empty keyword are required' });
    }

    const normalizedKeyword = keyword.trim().toLowerCase();

    // FIX #5: $addToSet ensures no duplicates and never overwrites the full array
    const config = await AutoDmConfig.findOneAndUpdate(
      { videoId, userId: req.user.id },
      { $addToSet: { keywords: normalizedKeyword } },
      { new: true }
    );

    if (!config) {
      return res.status(404).json({ error: 'Auto DM config not found for this video. Save the config first.' });
    }

    console.log(`[Fix #5] Keyword "${normalizedKeyword}" added via $addToSet for video ${videoId} (autoDm.js)`);
    return res.json({ keywords: config.keywords });
  } catch (error) {
    logger.error(`[Auto DM Route] Error adding keyword: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/auto-dm/keywords/remove
 * @desc FIX #5 — Atomically remove a single keyword from the config using $pull
 *       (removes only the specified keyword, never touches the rest of the array)
 * @access Private
 */
router.post('/keywords/remove', authMiddleware, async (req, res) => {
  try {
    const { videoId, keyword } = req.body;
    if (!videoId || !keyword || typeof keyword !== 'string' || !keyword.trim()) {
      return res.status(400).json({ error: 'videoId and a non-empty keyword are required' });
    }

    const normalizedKeyword = keyword.trim().toLowerCase();

    // FIX #5: $pull removes only the exact keyword, other keywords remain untouched
    const config = await AutoDmConfig.findOneAndUpdate(
      { videoId, userId: req.user.id },
      { $pull: { keywords: normalizedKeyword } },
      { new: true }
    );

    if (!config) {
      return res.status(404).json({ error: 'Auto DM config not found for this video.' });
    }

    console.log(`[Fix #5] Keyword "${normalizedKeyword}" removed via $pull for video ${videoId} (autoDm.js)`);
    return res.json({ keywords: config.keywords });
  } catch (error) {
    logger.error(`[Auto DM Route] Error removing keyword: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
