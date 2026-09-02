import cron from 'node-cron';
import Channel from '../models/Channel.mjs';
import Video from '../models/Video.mjs';
import { getYouTubeClient, getYouTubeClientWithApiKey } from '../services/youtubeService.mjs';
import { decrypt } from '../utils/cryptoHelper.mjs';
import logger from '../utils/logger.mjs';
import { acquireLock, releaseLock } from '../utils/lockHelper.mjs';

/**
 * YouTube Data Freshness & Re-sync Worker
 * Enforces YouTube API Services Policy III.E.4.a-g (30-Day Data Freshness & Retention).
 *
 * Automatically re-fetches and updates:
 * 1. Channel statistics (subscriberCount, videoCount, viewCount)
 * 2. Video statistics (viewCount, likeCount, commentCount, duration)
 * on a rolling basis so that no stored/served YouTube data exceeds 30 days of age.
 */

export const refreshAllYouTubeData = async () => {
  const lockKey = 'youtube_data_freshness_worker_lock';
  const hasLock = await acquireLock(lockKey, 30 * 60 * 1000); // 30 mins lock
  if (!hasLock) {
    logger.info('[FRESHNESS-WORKER] Re-sync already running on another instance. Skipping.');
    return;
  }

  try {
    logger.info('🔄 [FRESHNESS-WORKER] Starting rolling YouTube data refresh to ensure 30-day freshness compliance...');

    // 1. Clean up orphaned Video records whose channel no longer exists
    const activeChannels = await Channel.find({ status: 'connected' }).lean();
    const activeChannelIds = activeChannels.map(c => c.channelId);
    
    if (activeChannelIds.length > 0) {
      const orphanResult = await Video.deleteMany({ channelId: { $nin: activeChannelIds } });
      if (orphanResult.deletedCount > 0) {
        logger.info(`🧹 [FRESHNESS-WORKER] Purged ${orphanResult.deletedCount} orphaned video records.`);
      }
    }

    // 1b. Purge any stored Video records that have not been refreshed in >30 days (Policy III.E.4.b-c)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const staleVideoPurge = await Video.deleteMany({
      $or: [
        { lastFetchedAt: { $lt: thirtyDaysAgo } },
        { lastFetchedAt: { $exists: false }, updatedAt: { $lt: thirtyDaysAgo } }
      ]
    });
    if (staleVideoPurge.deletedCount > 0) {
      logger.info(`🧹 [FRESHNESS-WORKER] Purged ${staleVideoPurge.deletedCount} stale video records older than 30 days.`);
    }

    // 2. Iterate through all active connected channels and refresh channel + video stats
    for (const channel of activeChannels) {
      try {
        if (channel.reconnectRequired) {
          logger.info(`[FRESHNESS-WORKER] Channel ${channel.title || channel.channelId} requires reconnect. Skipping.`);
          continue;
        }

        let youtube;
        if (channel.apiKey) {
          youtube = getYouTubeClientWithApiKey(decrypt(channel.apiKey));
        } else if (channel.accessToken) {
          const decryptedTokens = {
            access_token: decrypt(channel.accessToken),
            refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
            expiry_date: channel.expiryDate
          };
          youtube = getYouTubeClient(decryptedTokens, null, channel._id);
        } else {
          continue;
        }

        // 2a. Refresh Channel Statistics from YouTube API
        logger.info(`[FRESHNESS-WORKER] Refreshing channel statistics for: ${channel.title || channel.channelId}`);
        const channelRes = await youtube.channels.list({
          part: 'snippet,statistics,contentDetails',
          id: channel.channelId
        });

        const channelItem = channelRes.data?.items?.[0];
        if (channelItem) {
          await Channel.updateOne(
            { _id: channel._id },
            {
              $set: {
                title: channelItem.snippet?.title || channel.title,
                thumbnailUrl: channelItem.snippet?.thumbnails?.default?.url || channel.thumbnailUrl,
                'statistics.subscriberCount': channelItem.statistics?.subscriberCount || '0',
                'statistics.videoCount': channelItem.statistics?.videoCount || '0',
                'statistics.viewCount': channelItem.statistics?.viewCount || '0',
                lastSyncedAt: new Date()
              }
            }
          );
        }

        // 2b. Refresh Video Statistics for stored videos of this channel
        const storedVideos = await Video.find({ channelId: channel.channelId }).lean();
        if (storedVideos.length > 0) {
          const videoIds = storedVideos.map(v => v.videoId).filter(Boolean);
          const chunkSize = 50; // YouTube API allows max 50 IDs per request

          for (let i = 0; i < videoIds.length; i += chunkSize) {
            const chunk = videoIds.slice(i, i + chunkSize);
            try {
              const videoListRes = await youtube.videos.list({
                part: 'snippet,statistics,contentDetails',
                id: chunk.join(',')
              });

              const items = videoListRes.data?.items || [];
              const returnedIds = new Set(items.map(it => it.id));
              const bulkOps = [];

              for (const item of items) {
                const viewCount = parseInt(item.statistics?.viewCount || 0, 10);
                const likeCount = parseInt(item.statistics?.likeCount || 0, 10);
                const commentCount = parseInt(item.statistics?.commentCount || 0, 10);
                const duration = item.contentDetails?.duration || '';
                const engagementRate = viewCount > 0
                  ? parseFloat((((likeCount + commentCount) / viewCount) * 100).toFixed(2))
                  : 0;

                bulkOps.push({
                  updateOne: {
                    filter: { channelId: channel.channelId, videoId: item.id },
                    update: {
                      $set: {
                        title: item.snippet?.title,
                        description: item.snippet?.description,
                        thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
                        duration,
                        'statistics.viewCount': viewCount,
                        'statistics.likeCount': likeCount,
                        'statistics.commentCount': commentCount,
                        engagementRate,
                        lastFetchedAt: new Date()
                      }
                    }
                  }
                });
              }

              // Remove videos that were deleted from YouTube
              for (const vId of chunk) {
                if (!returnedIds.has(vId)) {
                  bulkOps.push({
                    deleteOne: {
                      filter: { channelId: channel.channelId, videoId: vId }
                    }
                  });
                }
              }

              if (bulkOps.length > 0) {
                await Video.bulkWrite(bulkOps);
              }
            } catch (chunkErr) {
              logger.error(`[FRESHNESS-WORKER] Error refreshing video chunk for channel ${channel.channelId}: ${chunkErr.message}`);
            }
          }
          logger.info(`[FRESHNESS-WORKER] Successfully refreshed ${storedVideos.length} videos for ${channel.title || channel.channelId}`);
        }
      } catch (chanErr) {
        logger.error(`[FRESHNESS-WORKER] Error refreshing channel ${channel.channelId}: ${chanErr.message}`);
      }
    }

    logger.info('✅ [FRESHNESS-WORKER] YouTube data freshness re-sync completed successfully.');
  } catch (err) {
    logger.error(`❌ [FRESHNESS-WORKER] Critical error during YouTube data refresh: ${err.message}`);
  } finally {
    await releaseLock(lockKey);
  }
};

/**
 * Initialize background cron job (Runs every 6 hours: cron schedule 0 * / 6 * * *)
 */
export const initYouTubeDataRefreshWorker = () => {
  logger.info('⏰ [FRESHNESS-WORKER] Initializing YouTube Data Freshness Worker (Schedule: Every 6 hours)');
  
  // Run 1 minute after server boot to verify freshness
  setTimeout(() => {
    refreshAllYouTubeData().catch(err => {
      logger.error(`[FRESHNESS-WORKER] Startup refresh error: ${err.message}`);
    });
  }, 60000);

  // Scheduled recurring cron job
  cron.schedule('0 */6 * * *', async () => {
    logger.info('⏰ [FRESHNESS-WORKER] Triggering scheduled 6-hour YouTube data refresh...');
    await refreshAllYouTubeData();
  });
};

export default initYouTubeDataRefreshWorker;
