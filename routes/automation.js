import express from 'express';
import { processComments } from '../services/commentProcessingService.mjs';
import Channel from '../models/Channel.mjs';
import logger from '../utils/logger.mjs';

const router = express.Router();

/**
 * @route POST /api/automation/run-now
 * @desc Manually trigger comment automation processing cycle using the centralized service
 * @access Public
 */
router.post('/run-now', async (req, res) => {
  try {
    logger.info('[AUTOMATION ROUTE] Manual comment automation run requested.');
    const io = req.app.get('io');
    const channels = await Channel.find();
    let processedChannelsCount = 0;

    for (const channel of channels) {
      if (channel.reconnectRequired) {
        logger.info(`[AUTOMATION ROUTE] Skipping reconnect-required channel ${channel.title || channel.channelId}`);
        continue;
      }
      if (channel.channelId && (channel.channelId.startsWith('PENDING_') || channel.channelId === 'pending')) {
        logger.info(`[AUTOMATION ROUTE] Skipping pending channel ${channel.title || channel.channelId}`);
        continue;
      }

      if (channel.apiKey) {
        await processComments(channel, null, channel.apiKey, io);
      } else {
        await processComments(channel, {
          access_token: channel.accessToken,
          refresh_token: channel.refreshToken,
          expiry_date: channel.expiryDate,
        }, null, io);
      }
      processedChannelsCount++;
    }

    return res.status(200).json({
      success: true,
      message: `Comment automation run completed successfully for ${processedChannelsCount} channels.`
    });
  } catch (error) {
    logger.error('[AUTOMATION ROUTE] Manual run encountered an error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
