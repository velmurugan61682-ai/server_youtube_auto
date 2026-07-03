import cron from 'node-cron';
import mongoose from 'mongoose';
import logger from '../utils/logger.mjs';
import CommentLog from '../models/CommentLog.js';
import Channel from '../models/Channel.mjs';
import { classifyComment } from '../services/deepseekService.js';
import { sendWhatsAppAlert } from '../services/whatsappService.js';
import { generateAndPostAutoReply } from '../services/autoReplyService.mjs';
import { getYouTubeAuth } from '../services/youtubeService.mjs';
import { decrypt, encrypt } from '../utils/cryptoHelper.mjs';
import { google } from 'googleapis';

// Cache to prevent duplicate video details queries within the same job run
const videoDetailsCache = new Map();

/**
 * Helper to fetch and cache video details (title and description) for a specific authenticated youtube client.
 */
const getCachedVideoDetails = async (youtube, videoId) => {
  if (!videoId) return null;
  if (videoDetailsCache.has(videoId)) {
    return videoDetailsCache.get(videoId);
  }

  try {
    logger.info(`[Comment Automation] Fetching details for video ID: ${videoId}`);
    const response = await youtube.videos.list({
      part: 'snippet',
      id: videoId
    });

    const item = response.data.items?.[0];
    if (item) {
      const details = {
        title: item.snippet.title,
        description: item.snippet.description
      };
      videoDetailsCache.set(videoId, details);
      return details;
    }

    logger.warn(`[Comment Automation] No video details found for video ID: ${videoId}`);
    return null;
  } catch (error) {
    logger.error(`[Comment Automation] Error fetching details for video ${videoId}: ${error.message}`);
    return null;
  }
};

/**
 * Resolves or refreshes Google OAuth credentials for a specific channel document, returning an authenticated youtube client.
 */
const getYouTubeClientForChannel = async (channel) => {
  if (channel.apiKey) {
    const apiKey = decrypt(channel.apiKey);
    return google.youtube({ version: 'v3', auth: apiKey });
  }

  const auth = getYouTubeAuth();
  const tokens = {
    access_token: decrypt(channel.accessToken),
    refresh_token: decrypt(channel.refreshToken),
    expiry_date: channel.expiryDate
  };
  auth.setCredentials(tokens);

  const expiryDate = tokens.expiry_date || 0;
  const isExpired = !tokens.access_token || expiryDate - 120000 < Date.now();

  if (isExpired) {
    logger.info(`[Comment Automation] Access token expired or expiring soon for channel: ${channel.title || channel.channelId}. Refreshing...`);
    try {
      const response = await auth.refreshAccessToken();
      const newTokens = response.credentials;
      auth.setCredentials(newTokens);

      await Channel.findByIdAndUpdate(channel._id, {
        $set: {
          accessToken: encrypt(newTokens.access_token),
          refreshToken: encrypt(newTokens.refresh_token || decrypt(channel.refreshToken)),
          expiryDate: newTokens.expiry_date
        }
      });
      logger.info(`[Comment Automation] Refreshed tokens successfully saved to MongoDB for channel: ${channel.title || channel.channelId}`);
    } catch (refreshError) {
      logger.error(`[Comment Automation] Failed to refresh access token for channel ${channel.title || channel.channelId}: ${refreshError.message}`);
      
      const errMsg = refreshError.message || '';
      const isUnauthorized = errMsg.includes('invalid_grant') || errMsg.includes('deleted_client') || errMsg.includes('unauthorized_client');
      if (isUnauthorized) {
        await Channel.findByIdAndUpdate(channel._id, {
          $set: {
            reconnectRequired: true,
            reconnectReason: errMsg || 'Token invalid or revoked'
          }
        });
      }
      throw refreshError;
    }
  }

  return google.youtube({ version: 'v3', auth });
};

/**
 * Fetches latest comment threads for a specific channel
 */
const fetchCommentThreadsForChannel = async (youtube, channelId, maxResults = 20) => {
  logger.info(`[Comment Automation] Fetching latest comment threads for channel ID: ${channelId}...`);
  const response = await youtube.commentThreads.list({
    part: 'snippet,replies',
    allThreadsRelatedToChannelId: channelId,
    maxResults,
    order: 'time'
  });
  return response.data.items || [];
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
    // 1. Fetch connected channels from MongoDB
    const channels = await Channel.find();
    if (!channels.length) {
      logger.info("No connected channels. Skipping automation.");
      return { success: true, processed: 0 };
    }

    for (const channel of channels) {
      if (channel.reconnectRequired) {
        logger.info(`[Comment Automation] Skipping channel ${channel.title || channel.channelId} (reconnection required).`);
        continue;
      }

      logger.info(`[Comment Automation] Processing channel: ${channel.title || channel.channelId}`);

      let youtube;
      try {
        youtube = await getYouTubeClientForChannel(channel);
      } catch (authError) {
        logger.error(`[Comment Automation] Skipping channel ${channel.title || channel.channelId} due to auth failure: ${authError.message}`);
        continue;
      }

      try {
        const threads = await fetchCommentThreadsForChannel(youtube, channel.channelId, 20);
        logger.info(`[Comment Automation] Retrieved ${threads.length} comment threads from channel ${channel.title || channel.channelId}.`);

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
                await youtube.comments.setModerationStatus({
                  id: [commentId],
                  moderationStatus
                });
                actionTaken = category === 'toxic' ? 'comment_removed' : 'comment_hidden';
                logger.info(`[Comment Automation] Comment ${commentId} moderated: ${moderationStatus} (Category: ${category})`);
              } catch (modError) {
                logger.error(`[Comment Automation] Failed to apply moderation status for comment ${commentId}: ${modError.message}`);
              }

              // Send WhatsApp alert to channel owner if comment is toxic
              if (category === 'toxic') {
                try {
                  const videoDetails = await getCachedVideoDetails(youtube, videoId);
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
                  youtube,
                  parentId: commentId,
                  commentText,
                  commentId,
                  videoId,
                  userId: channel.userId
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
      } catch (channelRunError) {
        logger.error(`[Comment Automation] Error processing channel ${channel.title || channel.channelId}: ${channelRunError.message}`);
      }
    }

    // Clear video details cache at the end of the run
    videoDetailsCache.clear();

    logger.info(`[Comment Automation] Completed run. Processed ${processedCount} new comments.`);
    return { success: true, processed: processedCount };
  } catch (error) {
    logger.error(`[Comment Automation] ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Initializes the node-cron scheduler to run every 5 minutes.
 * (DISABLED in favor of unified commentJob.mjs)
 */
export const initCommentAutomation = () => {
  logger.info('[Comment Automation] Scheduler is disabled in favor of centralized commentJob.mjs.');
};

// Auto-bootstrap once Mongoose connects (DISABLED to prevent duplicate background workers)
/*
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
*/
