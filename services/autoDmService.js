import { google } from 'googleapis';
import logger from '../utils/logger.mjs';
import AutoDmConfig from '../models/AutoDmConfig.js';
import RepliedComment from '../models/RepliedComment.js';
import Video from '../models/Video.mjs';
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import { decrypt, encrypt } from '../utils/cryptoHelper.mjs';
import {
  getYouTubeClient,
  getYouTubeClientWithApiKey,
  getYouTubeAuth,
  fetchLatestComments,
  replyToComment
} from './youtubeService.mjs';

/**
 * Helper to check if text contains any keywords (case-insensitive)
 * Returns the matched keyword or null.
 */
const containsKeyword = (text, keywords) => {
  if (!text || !keywords || !Array.isArray(keywords)) return null;
  const lowercaseText = text.toLowerCase();
  for (const keyword of keywords) {
    if (!keyword) continue;
    if (lowercaseText.includes(keyword.trim().toLowerCase())) {
      return keyword.trim();
    }
  }
  return null;
};

/**
 * Fetch latest comments for a video using YouTube Data API v3
 */
export const fetchVideoComments = async (youtube, channelId, videoId) => {
  try {
    logger.info(`[Auto DM Service] Fetching comments for video: ${videoId}`);
    const comments = await fetchLatestComments(youtube, channelId, 50, videoId);
    return comments || [];
  } catch (error) {
    logger.error(`[Auto DM Service] Error fetching comments for video ${videoId}: ${error.message}`);
    throw error;
  }
};

/**
 * Process a single video config for auto DMs
 */
export const processVideo = async (videoId) => {
  logger.info(`[Auto DM Service] Starting processing for video: ${videoId}`);
  
  const config = await AutoDmConfig.findOne({ videoId });
  if (!config) {
    logger.warn(`[Auto DM Service] No configuration found for video: ${videoId}`);
    return { success: false, reason: 'Config not found' };
  }

  if (!config.enabled) {
    logger.info(`[Auto DM Service] Auto DM is disabled for video: ${videoId}`);
    return { success: false, reason: 'Config is disabled' };
  }

  const video = await Video.findOne({ videoId });
  if (!video) {
    logger.warn(`[Auto DM Service] Video document not found in DB for: ${videoId}. Auto-disabling this config to prevent repeated retries.`);
    // Auto-disable the config so the cron stops trying every 5 minutes
    config.enabled = false;
    await config.save().catch((saveErr) =>
      logger.error(`[Auto DM Service] Failed to auto-disable config for ${videoId}: ${saveErr.message}`)
    );
    return { success: false, reason: 'Video not found in DB — config auto-disabled' };
  }

  const channel = await Channel.findOne({ channelId: config.channelId });
  if (!channel) {
    logger.warn(`[Auto DM Service] Channel document not found in DB for channelId: ${config.channelId}`);
    return { success: false, reason: 'Channel not found in DB' };
  }

  if (channel.reconnectRequired) {
    logger.warn(`[Auto DM Service] Channel ${channel.title} requires reconnect. Skipping.`);
    return { success: false, reason: 'Channel requires reconnection' };
  }

  try {
    // Resolve YouTube API Client
    let youtube;
    if (channel.apiKey) {
      youtube = getYouTubeClientWithApiKey(decrypt(channel.apiKey));
    } else {
      const auth = getYouTubeAuth();
      const tokens = {
        access_token: decrypt(channel.accessToken),
        refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
        expiry_date: channel.expiryDate
      };
      auth.setCredentials(tokens);

      const expiryDate = tokens.expiry_date || 0;
      const isExpired = !tokens.access_token || expiryDate - 120000 < Date.now();

      if (isExpired) {
        logger.info(`[Auto DM Service] Access token expired or expiring soon for channel: ${channel.title || channel.channelId}. Refreshing...`);
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
        } catch (refreshErr) {
          logger.error(`[Auto DM Service] Failed to refresh token for channel ${channel.title}: ${refreshErr.message}`);
          throw refreshErr;
        }
      }
      youtube = google.youtube({ version: 'v3', auth });
    }

    // Fetch comments
    const comments = await fetchVideoComments(youtube, channel.channelId, videoId);
    let repliesSent = 0;

    for (const comment of comments) {
      // 1. Idempotency Check: check if already replied to this commentId
      const exists = await RepliedComment.findOne({ commentId: comment.youtubeId });
      if (exists) continue;

      // 2. Keyword Check
      const matchedKeyword = containsKeyword(comment.text, config.keywords);
      if (!matchedKeyword) continue;

      logger.info(`[Auto DM Service] Found keyword match in comment ${comment.youtubeId}: "${comment.text}"`);

      // 3. Prepare link and reply text
      const cleanNumber = config.whatsappNumber.replace(/[^\d]/g, '');
      const whatsappLink = `https://wa.me/${cleanNumber}`;

      if (!config.replyTemplates || config.replyTemplates.length === 0) {
        logger.warn(`[Auto DM Service] No reply templates configured for video ${videoId}`);
        continue;
      }

      const randomTemplate = config.replyTemplates[Math.floor(Math.random() * config.replyTemplates.length)];
      const replyText = randomTemplate.replace(/{whatsapp_link}/g, whatsappLink);

      // 4. Create database lock record to prevent duplicate reply racing
      try {
        const repliedLog = new RepliedComment({
          userId: config.userId,
          channelId: config.channelId,
          videoId: config.videoId,
          commentId: comment.youtubeId,
          author: comment.author,
          commentText: comment.text,
          matchedKeyword,
          replyText: 'pending',
          whatsappLink,
          repliedAt: new Date()
        });
        await repliedLog.save();

        // 5. Post public reply on YouTube
        const replyResult = await replyToComment(youtube, comment.youtubeId, replyText);

        if (replyResult.success) {
          await RepliedComment.updateOne(
            { commentId: comment.youtubeId },
            { $set: { replyText } }
          );
          repliesSent++;
          logger.info(`[Auto DM Service] Posted reply to comment ${comment.youtubeId} successfully.`);

          // FIX #2: Save the bot reply comment in MongoDB with isBotReply=true
          // so the moderation pipeline skips it instead of flagging it as toxic.
          if (replyResult.newCommentId) {
            try {
              await Comment.findOneAndUpdate(
                { youtubeId: replyResult.newCommentId, userId: config.userId },
                {
                  $setOnInsert: {
                    userId: config.userId,
                    youtubeId: replyResult.newCommentId,
                    channelId: config.channelId,
                    videoId: config.videoId,
                    text: replyText,
                    author: 'Bot (Auto-Reply)',
                    authorChannelId: channel.channelId,
                    publishedAt: new Date(),
                    status: 'approved',
                    aiActionTaken: true,
                    aiStatus: 'completed',
                    classification: 'bot_reply',
                    moderationStatus: 'safe',
                    actionTaken: 'skip_bot',
                  },
                  $set: { isBotReply: true, hasReplied: false }
                },
                { upsert: true, new: true }
              );
              logger.info(`[Auto DM Service] [FIX #2] Saved bot reply ${replyResult.newCommentId} in MongoDB with isBotReply=true to prevent self-moderation. (autoDmService.js)`);
            } catch (saveErr) {
              logger.error(`[Auto DM Service] [FIX #2] Failed to save bot reply in Comment model: ${saveErr.message}`);
            }
          }
          // END FIX #2

          // Wait random delay between 30-60 seconds before next reply
          const delayMs = Math.floor(Math.random() * (60000 - 30000 + 1)) + 30000;
          logger.info(`[Auto DM Service] Sleeping for ${delayMs / 1000} seconds to avoid spam flags...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          // If post fails, delete the record to allow retrying later
          await RepliedComment.deleteOne({ commentId: comment.youtubeId });
          logger.error(`[Auto DM Service] Failed to post reply via YouTube API: ${replyResult.reason}`);
        }
      } catch (dbErr) {
        if (dbErr.code === 11000) {
          // duplicate key (commentId already created), skip
          continue;
        }
        logger.error(`[Auto DM Service] Database error during locking/saving: ${dbErr.message}`);
        await RepliedComment.deleteOne({ commentId: comment.youtubeId }).catch(() => {});
      }
    }

    // Update last run time
    config.lastRunAt = new Date();
    await config.save();

    logger.info(`[Auto DM Service] Completed run for video ${videoId}. Sent ${repliesSent} replies.`);
    return { success: true, repliesSent };
  } catch (error) {
    logger.error(`[Auto DM Service] Processing failed for video ${videoId}: ${error.message}`);
    return { success: false, reason: error.message };
  }
};
