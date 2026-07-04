import cron from 'node-cron';
import logger from '../utils/logger.mjs';
import AutoDmConfig from '../models/AutoDmConfig.js';
import Video from '../models/Video.mjs';
import { processVideo } from '../services/autoDmService.js';

// Guard flag to prevent double-initialization
let cronInitialized = false;

/**
 * Known placeholder/test patterns that should never be processed.
 */
const INVALID_VIDEO_ID_PATTERNS = [
  /^test/i,
  /^example/i,
  /^placeholder/i,
  /^xxx/i,
  /^fake/i,
  /^demo/i,
  /^sample/i,
];

const isInvalidVideoId = (videoId) => {
  if (!videoId || typeof videoId !== 'string') return true;
  if (videoId.trim().length < 6) return true;
  return INVALID_VIDEO_ID_PATTERNS.some((pattern) => pattern.test(videoId.trim()));
};

export const initAutoDmCron = () => {
  if (cronInitialized) {
    logger.warn('[Auto DM Cron] initAutoDmCron() called again — skipping duplicate initialization.');
    return;
  }
  cronInitialized = true;

  logger.info('[Auto DM Cron] Initializing Auto DM cron job (Every 5 minutes)...');

  cron.schedule('*/5 * * * *', async () => {
    try {
      logger.info('[Auto DM Cron] Running scheduled Auto DM scan...');

      // Find all configurations that are enabled
      const configs = await AutoDmConfig.find({ enabled: true });
      logger.info(`[Auto DM Cron] Found ${configs.length} active Auto DM configurations.`);

      for (const config of configs) {
        try {
          // ── Validation: skip invalid/placeholder videoIds ──
          if (isInvalidVideoId(config.videoId)) {
            logger.warn(`[Auto DM Cron] Skipping invalid/placeholder videoId: "${config.videoId}". Disabling config.`);
            config.enabled = false;
            await config.save();
            continue;
          }

          // ── Validation: verify video exists in DB before processing ──
          const videoExists = await Video.exists({ videoId: config.videoId });
          if (!videoExists) {
            logger.warn(`[Auto DM Cron] Video "${config.videoId}" not found in DB. Auto-disabling this Auto DM config.`);
            config.enabled = false;
            await config.save();
            continue;
          }

          logger.info(`[Auto DM Cron] Scanning comments for video: ${config.videoId}`);
          await processVideo(config.videoId);
        } catch (videoErr) {
          logger.error(`[Auto DM Cron] Error processing video ${config.videoId}: ${videoErr.message}`);
        }
      }
    } catch (cronErr) {
      logger.error(`[Auto DM Cron] Global error in Auto DM cron job: ${cronErr.message}`);
    }
  });

  logger.info('[Auto DM Cron] Cron job registered successfully.');
};

// NOTE: Do NOT call initAutoDmCron() here at module level.
// It is called from index.mjs after MongoDB is connected and server.listen() succeeds.
