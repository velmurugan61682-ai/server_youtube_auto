import cron from 'node-cron';
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import { processComments } from '../services/commentProcessingService.mjs';
import logger from '../utils/logger.mjs';
import { acquireLock, releaseLock } from '../utils/lockHelper.mjs';

const runRecoveryAndSync = async (io) => {
  const lockKey = 'comment_job_recovery_sync';
  const hasLock = await acquireLock(lockKey, 600000); // 10 minutes lock for startup recovery
  if (!hasLock) {
    logger.info('[RECOVERY] Startup Recovery: Recovery/sync already running on another instance. Skipping.');
    return;
  }
  try {
    logger.info('🚀 Startup Recovery: Initiating recovery scan for stuck jobs...');
    
    // 0. Deduplicate channel records safely within user scopes
    logger.info('🧹 Startup Recovery: Deduplicating channel records in MongoDB...');
    const channelsList = await Channel.find().sort({ updatedAt: -1 });
    const seen = new Set();
    let deletedCount = 0;
    for (const chan of channelsList) {
      const uniqueKey = `${chan.userId ? chan.userId.toString() : 'unknown'}_${chan.channelId}`;
      if (seen.has(uniqueKey)) {
        logger.info(`🧹 Startup Recovery: Removing duplicate channel record: ${chan.title} (ID: ${chan.channelId}, User: ${chan.userId}, MongoDB ID: ${chan._id})`);
        await Channel.deleteOne({ _id: chan._id });
        deletedCount++;
      } else {
        seen.add(uniqueKey);
      }
    }
    logger.info(`🧹 Startup Recovery: Channel deduplication complete. Removed ${deletedCount} duplicate records.`);

    // 1. Reset stuck channel initial sync locks (where lastSyncedAt was set to Jan 1, 1970 00:00:00)
    const lockedChannels = await Channel.find({
      lastSyncedAt: new Date(0)
    });
    if (lockedChannels.length > 0) {
      logger.info(`🚀 Startup Recovery: Found ${lockedChannels.length} stuck channel syncs. Resetting lastSyncedAt to null.`);
      for (const channel of lockedChannels) {
        channel.lastSyncedAt = null;
        await channel.save();
      }
    }

    // 2. Reset stuck comment processing states (aiStatus = 'processing') or pending replies
    const stuckComments = await Comment.find({
      $or: [
        { aiStatus: 'processing' },
        { replyStatus: 'pending' }
      ]
    });
    if (stuckComments.length > 0) {
      logger.info(`🚀 Startup Recovery: Found ${stuckComments.length} comments stuck in processing/pending reply. Resetting statuses.`);
      for (const comment of stuckComments) {
        if (comment.aiStatus === 'processing') {
          comment.aiStatus = 'pending';
        }
        if (comment.replyStatus === 'pending') {
          comment.replyStatus = 'none';
        }
        await comment.save();
      }
    }
    logger.info('Startup Recovery Complete');
    logger.info('🚀 Startup Recovery: Triggering sync for all channels...');
    const channels = await Channel.find();
    for (const channel of channels) {
      if (channel.reconnectRequired) {
        logger.info(`🚀 Startup Recovery: Skipping reconnect-required channel ${channel.title || channel.channelId}`);
        continue;
      }
      if (channel.channelId && (channel.channelId.startsWith('PENDING_') || channel.channelId === 'pending')) {
        logger.info(`🚀 Startup Recovery: Skipping pending channel ${channel.title || channel.channelId}`);
        continue;
      }

      if (channel.apiKey) {
        processComments(channel, null, channel.apiKey, io).catch(err => 
          logger.error(`Startup sync failed for channel ${channel.channelId}:`, err)
        );
      } else {
        processComments(channel, {
          access_token: channel.accessToken,
          refresh_token: channel.refreshToken,
          expiry_date: channel.expiryDate,
        }, null, io).catch(err => 
          logger.error(`Startup sync failed for channel ${channel.channelId}:`, err)
        );
      }
    }
  } catch (error) {
    logger.error('Startup recovery error:', error);
  } finally {
    await releaseLock(lockKey);
  }
};

export const initCommentJob = (io) => {
  // Trigger recovery/sync immediately on server startup
  runRecoveryAndSync(io);

  // Schedule the scan to run every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    const lockKey = 'comment_job_cron_sync';
    const hasLock = await acquireLock(lockKey, 180000); // 3 minutes lock
    if (!hasLock) {
      logger.info('[CRON] Scheduled comment sync is already running on another instance. Skipping.');
      return;
    }
    try {
      logger.info('Running scheduled 30-second comment analysis...');
      const channels = await Channel.find();
      for (const channel of channels) {
        if (channel.reconnectRequired) {
          logger.info(`[CRON] Skipping reconnect-required channel ${channel.title || channel.channelId}`);
          continue;
        }
        if (channel.channelId && (channel.channelId.startsWith('PENDING_') || channel.channelId === 'pending')) {
          logger.info(`[CRON] Skipping pending channel ${channel.title || channel.channelId}`);
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
      }
    } catch (error) {
      logger.error('Cron error:', error);
    } finally {
      await releaseLock(lockKey);
    }
  });
  logger.info('Scheduled comment analysis job initialized (Every 30s)');
};
