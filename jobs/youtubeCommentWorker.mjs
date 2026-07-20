import cron from 'node-cron';
import logger from '../utils/logger.mjs';
import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';
import { getYouTubeClient, getYouTubeClientWithApiKey, fetchLatestComments } from '../services/youtubeService.mjs';
import { decrypt, encrypt } from '../utils/cryptoHelper.mjs';
import { acquireLock, releaseLock } from '../utils/lockHelper.mjs';
import { processSingleComment } from '../services/commentProcessingService.mjs';

// Main worker task execution
export const runYouTubeCommentWorker = async (io) => {
  const lockKey = 'youtube_comment_worker_lock';
  const hasLock = await acquireLock(lockKey, 25000); // 25 seconds lock
  if (!hasLock) {
    logger.info('[YouTube Comment Worker] Worker already running on another instance. Skipping.');
    return;
  }

  try {
    logger.info('[YouTube Comment Worker] Scanning active channels for comments...');
    
    // Fetch connected channels
    const channels = await Channel.find({ status: 'connected' });
    if (channels.length === 0) {
      logger.info('[YouTube Comment Worker] No connected channels found. Skipping run.');
      return;
    }

    // Process comments for each channel
    for (const channel of channels) {
      if (channel.reconnectRequired) {
        logger.info(`[YouTube Comment Worker] Skipping reconnect-required channel ${channel.title || channel.channelId}`);
        continue;
      }
      if (channel.channelId && (channel.channelId.startsWith('PENDING_') || channel.channelId === 'pending')) {
        logger.info(`[YouTube Comment Worker] Skipping pending channel ${channel.title || channel.channelId}`);
        continue;
      }

      // Initialize YouTube API Client
      let youtube;
      try {
        if (channel.apiKey) {
          youtube = getYouTubeClientWithApiKey(decrypt(channel.apiKey));
        } else {
          const tokens = {
            access_token: decrypt(channel.accessToken),
            refresh_token: decrypt(channel.refreshToken),
            expiry_date: channel.expiryDate
          };
          
          youtube = getYouTubeClient(tokens, async (newTokens) => {
            logger.info(`[YouTube Comment Worker] Tokens auto-refreshed for channel ${channel.channelId}`);
            await Channel.findOneAndUpdate(
              { _id: channel._id },
              {
                accessToken: encrypt(newTokens.access_token),
                refreshToken: encrypt(newTokens.refresh_token || decrypt(channel.refreshToken)),
                expiryDate: newTokens.expiry_date
              }
            );
          }, channel._id);
        }
      } catch (authError) {
        logger.error(`[YouTube Comment Worker] Auth client setup failed for channel ${channel.channelId}: ${authError.message}`);
        continue;
      }

      // Fetch latest comment threads from YouTube
      let comments = [];
      try {
        comments = await fetchLatestComments(youtube, channel.channelId, 20);
      } catch (fetchError) {
        logger.error(`[YouTube Comment Worker] Failed to fetch comments for channel ${channel.channelId}: ${fetchError.message}`);
        continue;
      }

      if (comments.length > 0) {
        logger.info(`[YouTube Comment Worker] Processing ${comments.length} comments for channel ${channel.title || channel.channelId}`);
        
        const user = await User.findById(channel.userId);
        if (!user) {
          logger.warn(`[YouTube Comment Worker] User not found for channel ${channel.channelId}`);
          continue;
        }

        const userKey = user.openaiApiKey ? decrypt(user.openaiApiKey) : null;
        const userSettings = user.settings || { autoMod: true, autoLike: true, confidenceThreshold: 85 };

        for (const comment of comments) {
          // Skip replies in the main loop to avoid duplicating work (handled by processSingleComment)
          if (comment.isReply) continue;
          
          await processSingleComment(youtube, channel, userKey, userSettings, comment, io);
        }
      }
    }
  } catch (err) {
    logger.error(`[YouTube Comment Worker] Error in worker execution: ${err.message}`);
  } finally {
    await releaseLock(lockKey);
  }
};

// Scheduler setup
export const initYouTubeCommentWorker = (io) => {
  logger.info('[YouTube Comment Worker] Initializing scheduler...');
  
  // Run every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    logger.info('[YouTube Comment Worker] Running scheduled 30-second Auto Reply check...');
    await runYouTubeCommentWorker(io);
  });
  
  logger.info('[YouTube Comment Worker] Scheduled checking job initialized successfully (Every 30s)');
};
