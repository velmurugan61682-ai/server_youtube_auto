import cron from 'node-cron';
import logger from '../utils/logger.mjs';
import AutoDmConfig from '../models/AutoDmConfig.js';
import { processVideo } from '../services/autoDmService.js';

export const initAutoDmCron = () => {
  logger.info('[Auto DM Cron] Initializing Auto DM cron job (Every 5 minutes)...');

  cron.schedule('*/5 * * * *', async () => {
    try {
      logger.info('[Auto DM Cron] Running scheduled Auto DM scan...');
      
      // Find all configurations that are enabled
      const configs = await AutoDmConfig.find({ enabled: true });
      logger.info(`[Auto DM Cron] Found ${configs.length} active Auto DM configurations.`);

      for (const config of configs) {
        try {
          logger.info(`[Auto DM Cron] Scanning comments for video: ${config.videoId}`);
          // Process comments. The processVideo method handles randomized delays between replies inside the method
          await processVideo(config.videoId);
        } catch (videoErr) {
          logger.error(`[Auto DM Cron] Error processing video ${config.videoId}: ${videoErr.message}`);
        }
      }
    } catch (cronErr) {
      logger.error(`[Auto DM Cron] Global error in Auto DM cron job: ${cronErr.message}`);
    }
  });
};

// Start the cron job automatically on import
initAutoDmCron();
