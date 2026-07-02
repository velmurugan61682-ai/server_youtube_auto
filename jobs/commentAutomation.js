import cron from 'node-cron';
import mongoose from 'mongoose';
import logger from '../utils/logger.mjs';
import CommentLog from '../models/CommentLog.js';
import {
  fetchLatestCommentThreads,
  insertCommentReply,
  setCommentModeration,
  fetchVideoDetails
} from '../services/youtubeService.js';
import { classifyComment, generateReply } from '../services/deepseekService.js';
import { sendWhatsAppAlert } from '../services/whatsappService.js';
import { generateAndPostAutoReply } from '../services/autoReplyService.mjs';

// Cache to prevent duplicate video details queries within the same job run
const videoDetailsCache = new Map();

/**
 * Helper to fetch and cache video details (title and description)
 * 
 * @param {string} videoId 
 * @returns {Promise<{title: string, description: string}|null>}
 */
const getCachedVideoDetails = async (videoId) => {
  if (!videoId) return null;
  if (videoDetailsCache.has(videoId)) {
    return videoDetailsCache.get(videoId);
  }

  try {
    const details = await fetchVideoDetails(videoId);
    if (details) {
      videoDetailsCache.set(videoId, details);
    }
    return details;
  } catch (error) {
    logger.error(`[Comment Automation] Error fetching details for video ${videoId}: ${error.message}`);
    return null;
  }
};

/**
 * Main automation job pipeline. Fetch, classify, reply, moderate, notify, and log.
 * 
 * @returns {Promise<{success: boolean, processed?: number, error?: string}>}
 */
export const runCommentAutomation = async () => {
  logger.info('[Comment Automation] Starting scheduled YouTube Comment Automation run...');
  let processedCount = 0;

  try {
    // 1. Fetch latest comment threads (default 20 threads)
    const threads = await fetchLatestCommentThreads(20);
    logger.info(`[Comment Automation] Retrieved ${threads.length} comment threads from channel.`);

    for (const thread of threads) {
      const topLevelComment = thread.snippet?.topLevelComment;
      if (!topLevelComment) continue;

      const commentId = topLevelComment.id;
      const videoId = thread.snippet.videoId;
      const commenterName = topLevelComment.snippet.authorDisplayName;
      const commentText = topLevelComment.snippet.textOriginal || topLevelComment.snippet.textDisplay;

      // 2. Check if this comment has already been processed to avoid duplicate operations
      const alreadyProcessed = await CommentLog.findOne({ commentId });
      if (alreadyProcessed) {
        continue;
      }

      logger.info(`[Comment Automation] Processing new comment thread: ${commentId} by ${commenterName}`);

      let category = 'normal';
      let reason = 'Default fallback';
      let replyNeeded = false;
      let actionTaken = 'none';
      let replyText = null;
      let detectedLanguage = null;
      let whatsappSent = false;

      // Process single comment inside its own try-catch block to guarantee that failures do not crash the pipeline
      try {
        // A. Classify comment with DeepSeek API
        const classification = await classifyComment(commentText);
        category = classification.category || 'normal';
        reason = classification.reason || '';
        replyNeeded = !!classification.reply_needed;

        // B. Handle moderation actions for toxic/spam comments
        if (category === 'toxic' || category === 'spam') {
          // Reject toxic comments (delete/hide), Hold spam comments for review
          const moderationStatus = category === 'toxic' ? 'rejected' : 'heldForReview';
          
          try {
            await setCommentModeration(commentId, moderationStatus);
            actionTaken = category === 'toxic' ? 'comment_removed' : 'comment_hidden';
            logger.info(`[Comment Automation] Comment ${commentId} moderated: ${moderationStatus} (Category: ${category})`);
          } catch (modError) {
            logger.error(`[Comment Automation] Failed to apply moderation status for comment ${commentId}: ${modError.message}`);
          }

          // Send WhatsApp alert to channel owner if comment is toxic
          if (category === 'toxic') {
            try {
              const videoDetails = await getCachedVideoDetails(videoId);
              whatsappSent = await sendWhatsAppAlert({
                videoId,
                videoTitle: videoDetails?.title || 'Unknown Video Title',
                commenterName,
                commentText,
                actionTaken: moderationStatus === 'rejected' ? 'Rejected/Removed' : 'Held For Review'
              });
            } catch (waError) {
              logger.error(`[Comment Automation] Failed to send WhatsApp notification: ${waError.message}`);
            }
          }

        } else {
          // C. Handle auto-reply logic for normal/review comments
          try {
            const replyResult = await generateAndPostAutoReply({
              parentId: commentId,
              commentText,
              commentId,
              videoId,
              userId: null
            });

            if (replyResult.success) {
              replyText = replyResult.replyText;
              detectedLanguage = replyResult.detectedLanguage;
              actionTaken = 'reply_posted';
              logger.info(`[Comment Automation] Replied to comment ${commentId}: "${replyText}" (Language: ${detectedLanguage})`);
            } else {
              logger.warn(`[Comment Automation] Auto-reply was not posted: ${replyResult.reason}`);
            }
          } catch (replyError) {
            logger.error(`[Comment Automation] Failed to post auto-reply to comment ${commentId}: ${replyError.message}`);
          }
        }

        // D. Create permanent database log audit trail
        const log = new CommentLog({
          commentId,
          videoId,
          commenterName,
          originalText: commentText,
          category,
          reason,
          actionTaken,
          replyText: replyText || undefined,
          detectedLanguage: detectedLanguage || undefined,
          whatsappSent,
          timestamp: new Date()
        });

        await log.save();
        processedCount++;

        // E. Politeness delay to prevent hitting API rate limit bounds
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (singleCommentError) {
        logger.error(`[Comment Automation] Error while processing comment ${commentId}: ${singleCommentError.message}`);
      }
    }

    // Clear video details cache at the end of the run
    videoDetailsCache.clear();

    logger.info(`[Comment Automation] Completed run. Processed ${processedCount} new comments.`);
    return { success: true, processed: processedCount };
  } catch (error) {
    logger.error(`[Comment Automation] Critical failure in comment automation run: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Initializes the node-cron scheduler to run every 5 minutes.
 */
export const initCommentAutomation = () => {
  logger.info('[Comment Automation] Initializing cron job (every 5 minutes)...');
  
  // Register recurring cron task: */5 * * * *
  cron.schedule('*/5 * * * *', async () => {
    try {
      await runCommentAutomation();
    } catch (cronError) {
      logger.error(`[Comment Automation] Scheduled cron execution failed: ${cronError.message}`);
    }
  });
};

// Auto-bootstrap once Mongoose connects
if (mongoose.connection.readyState === 1) {
  logger.info('[Comment Automation] MongoDB is already connected. Starting scheduler...');
  initCommentAutomation();
  runCommentAutomation().catch(err => {
    logger.error(`[Comment Automation] Initial run failed: ${err.message}`);
  });
} else {
  mongoose.connection.once('open', () => {
    logger.info('[Comment Automation] MongoDB connected. Starting scheduler...');
    initCommentAutomation();
    runCommentAutomation().catch(err => {
      logger.error(`[Comment Automation] Initial run failed: ${err.message}`);
    });
  });
}
