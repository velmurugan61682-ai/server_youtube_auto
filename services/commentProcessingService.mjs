import mongoose from 'mongoose'; // Mongoose database connector
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import User from '../models/User.mjs';
import Lead from '../models/Lead.mjs';
import Video from '../models/Video.mjs';
import GoWhatsLog from '../models/GoWhatsLog.mjs';
import AutomationLog from '../models/AutomationLog.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import logger from '../utils/logger.mjs';
import moment from 'moment-timezone';
import { 
  getYouTubeClient, 
  getYouTubeClientWithApiKey, 
  fetchLatestComments, 
  likeComment, 
  deleteCommentFromYouTube, 
  hideComment, 
  replyToComment,
  fetchVideos,
  fetchAllVideos,
  fetchAllCommentsAndRepliesForVideo,
  isQuotaError
} from './youtubeService.mjs';

// In-memory backoff tracking
const channelBackoffs = new Map();

const getNextSyncTime = (channelId) => {
  const backoff = channelBackoffs.get(channelId);
  if (!backoff) return null;
  
  // Check if YouTube quota reset time (midnight Pacific Time) has passed since the failure
  const now = moment().tz('America/Los_Angeles');
  const lastFailure = moment(backoff.lastFailureTime).tz('America/Los_Angeles');
  const resetTime = moment().tz('America/Los_Angeles').startOf('day'); // Midnight today
  
  // If last failure was before midnight PT, the quota has reset
  if (lastFailure.isBefore(resetTime)) {
    channelBackoffs.delete(channelId);
    return null;
  }
  
  return backoff.nextSyncTime;
};

const handleQuotaError = (channelId) => {
  const backoff = channelBackoffs.get(channelId) || { attemptCount: 0 };
  
  if (backoff.attemptCount >= 8) {
    logger.error(`[SYNC] Maximum quota retry limit reached for channel ${channelId}. Skipping further retries until daily reset.`);
    return;
  }
  
  backoff.attemptCount += 1;
  backoff.lastFailureTime = new Date();
  
  // Exponential backoff starting at 1 hour (3600000 ms)
  const delay = Math.min(3600000 * Math.pow(2, backoff.attemptCount - 1), 24 * 3600000);
  backoff.nextSyncTime = new Date(Date.now() + delay);
  
  channelBackoffs.set(channelId, backoff);
  logger.warn(`[SYNC] Quota exceeded for channel ${channelId}. Exponential backoff applied: next sync allowed after ${backoff.nextSyncTime.toISOString()}`);
};

const clearQuotaBackoff = (channelId) => {
  channelBackoffs.delete(channelId);
};
import { classifyComment, analyzeVideo } from './aiService.mjs';
import { detectWhatsAppNumber, createLead } from './leadService.mjs';
import { sendWhatsAppMessage } from './gowhatsService.mjs';
import { encrypt, decrypt } from '../utils/cryptoHelper.mjs';
import { generateAndPostAutoReply } from './autoReplyService.mjs';

// Helper to log automation actions
const logAutomation = async (userId, actionType, description, details = {}) => {
  try {
    const log = new AutomationLog({
      userId,
      actionType,
      description,
      details,
      timestamp: new Date()
    });
    await log.save();
  } catch (e) {
    logger.error('Failed to save automation log:', e);
  }
};

// Robust transaction runner with standalone local MongoDB fallback
const runInTransaction = async (fn) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (error) {
    const isUnsupported = error.message && (
      error.message.includes('replica set') || 
      error.message.includes('sessions are not supported') ||
      error.code === 20
    );
    if (isUnsupported) {
      logger.warn('Transactions not supported by this MongoDB deployment. Running fallback...');
      return fn(null);
    }
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

/**
 * Moderates and processes a single comment using DeepSeek AI.
 * Receives a Mongoose Comment document.
 */
export const processSingleComment = async (youtube, channel, userKey, userSettings, commentDoc, io) => {
  try {
    const confidenceThresholdDecimal = (userSettings.confidenceThreshold || 85) / 100;
    const targetParentId = commentDoc.youtubeId.includes('.') ? commentDoc.youtubeId.split('.')[0] : commentDoc.youtubeId;

    // Guard: Prevent duplicate processing and replies
    if (commentDoc.aiActionTaken || commentDoc.replyStatus === 'sent' || commentDoc.replyStatus === 'pending' || commentDoc.replyText) {
      logger.info(`[MODERATION] Comment ${commentDoc.youtubeId} already processed or replied to. Skipping.`);
      return;
    }

    // ── FIX #2: Skip bot's own auto-reply comments from moderation pipeline ──────
    // Bot-authored comments (isBotReply flag OR authorChannelId matches this channel)
    // must never be sent to DeepSeek, never flagged toxic, and never deleted.
    const isBotOwnComment = commentDoc.isBotReply === true ||
      (commentDoc.authorChannelId &&
        channel.channelId &&
        commentDoc.authorChannelId === channel.channelId);

    if (isBotOwnComment) {
      logger.info(`[MODERATION] [FIX #2] Comment ${commentDoc.youtubeId} is a bot auto-reply. Marking safe and skipping moderation. (commentProcessingService.mjs)`);
      await Comment.updateOne(
        { _id: commentDoc._id },
        {
          $set: {
            aiActionTaken: true,
            aiStatus: 'completed',
            status: 'approved',
            classification: 'bot_reply',
            moderationStatus: 'safe',
            actionTaken: 'skip_bot',
            isBotReply: true
          }
        }
      );
      return;
    }
    // ── END FIX #2 ──────────────────────────────────────────────────────────────

    // ── FIX #3: Skip if this comment has already been replied to ────────────────
    if (commentDoc.hasReplied === true) {
      logger.info(`[MODERATION] [FIX #3] Comment ${commentDoc.youtubeId} already has hasReplied=true. Skipping duplicate reply. (commentProcessingService.mjs)`);
      return;
    }
    // ── END FIX #3 (hasReplied pre-check) ───────────────────────────────────────

    logger.info(`[MODERATION] Initiating DeepSeek analysis for comment ID ${commentDoc.youtubeId} by ${commentDoc.author}: "${commentDoc.text}"`);

    // DeepSeek Classifier
    const aiResult = await classifyComment(commentDoc.text, userKey);
    logger.info("DeepSeek analysis completed");
    const classification = aiResult.classification || 'Neutral';
    const rawAnalysis = aiResult.rawAnalysis || {};
    
    const confidence = aiResult.confidence || 0;
    const isConfident = confidence >= confidenceThresholdDecimal;
    const isMeaningful = commentDoc.text && commentDoc.text.trim().length > 3;

    let status = 'pending';
    let deleteFailed = false;
    let deleteErrorReason = null;
    let deleteReason = null;
    let deletedAt = null;
    let aiActionTaken = false;
    let wasHidden = false;

    // Moderation fields
    let moderationStatus = undefined;
    let aiStatus = 'completed';
    let actionTaken = undefined;
    let moderationReason = undefined;

    // Toxicity / Bad Category check (detecting all 12 requested categories)
    const isToxicOrBad = [
      'spam', 'promotion', 'toxic', 'abuse', 'threat', 'scam', 'hate', 'profanity', 
      'selfpromotion', 'advertisement', 'adult', 'bullying', 'violence', 'malicious_review', 'bad_words',
      'harassment', 'hate_speech', 'offensive', 'fake_review', 'offensive_review', 'bad words', 'hate speech',
      'self promotion', 'fake review', 'offensive review'
    ].includes(classification.toLowerCase()) || 
    rawAnalysis.toxic || rawAnalysis.spam || rawAnalysis.abuse || rawAnalysis.threat || 
    rawAnalysis.scam || rawAnalysis.hate || rawAnalysis.profanity || rawAnalysis.selfPromotion || 
    rawAnalysis.advertisement || rawAnalysis.maliciousReview || rawAnalysis.badWords ||
    rawAnalysis.harassment || rawAnalysis.hateSpeech || rawAnalysis.offensive ||
    rawAnalysis.fakeReview || rawAnalysis.offensiveReview;

    logger.info(`[MODERATION] Comment ${commentDoc.youtubeId} classification: ${classification}, isToxicOrBad: ${isToxicOrBad}`);

    // Auto-Delete / Auto-Hide Mod Action (runs automatically for all bad comments)
    if (isToxicOrBad) {
      moderationReason = classification;

      if (channel.apiKey) {
        status = 'flagged';
        moderationStatus = 'hidden';
        actionTaken = 'hide';
        deleteFailed = true;
        deleteErrorReason = 'Authentication via API Key does not permit write actions (OAuth required)';
        logger.warn(`[MODERATION] Channel connected via API Key. Cannot moderate comment ${commentDoc.youtubeId} on YouTube.`);
      } else {
        logger.info(`[MODERATION] Attempting deletion cascade for toxic comment ${commentDoc.youtubeId}`);
        const modRes = await deleteCommentFromYouTube(youtube, commentDoc.youtubeId);
        logger.info(`[MODERATION] YouTube moderation cascade result: ${JSON.stringify(modRes)}`);

        if (modRes.success) {
          aiActionTaken = true;
          if (modRes.action === 'delete' || modRes.action === 'reject') {
            status = 'deleted';
            deleteReason = `Auto-deleted/rejected bad comment: ${classification}`;
            deletedAt = new Date();
            moderationStatus = 'deleted';
            actionTaken = 'delete';
            await logAutomation(channel.userId, 'comment_delete', `Auto-deleted comment (action: ${modRes.action}) due to ${classification}`, { commentId: commentDoc.youtubeId, apiResponse: modRes });
          } else if (modRes.action === 'hide') {
            status = 'flagged';
            wasHidden = true;
            deleteReason = `Auto-hidden comment (delete fallback): ${classification}`;
            moderationStatus = 'hidden';
            actionTaken = 'hide';
            await logAutomation(channel.userId, 'comment_hide', `Auto-hid comment (action: ${modRes.action}) due to ${classification}`, { commentId: commentDoc.youtubeId, apiResponse: modRes });
          }
        } else {
          deleteFailed = true;
          deleteErrorReason = modRes.reason;
          status = 'flagged';
          moderationStatus = 'hidden';
          actionTaken = 'hide';
          await logAutomation(channel.userId, 'comment_mod_failed', `Failed to moderate comment ${commentDoc.youtubeId}: ${modRes.reason}`, { commentId: commentDoc.youtubeId, apiResponse: modRes });
        }
      }
    }

    // Auto-Like positive comments
    let autoLiked = false;
    let likeStatus = 'none';
    let likeError = null;

    const isPositive = (aiResult.sentiment === 'positive' || rawAnalysis.positive) && isConfident;

    if (status !== 'deleted' && status !== 'flagged' && isPositive && isMeaningful && userSettings.autoLike) {
      if (channel.apiKey) {
        likeStatus = 'not_supported';
        likeError = 'Authentication via API Key does not permit write actions (OAuth required)';
      } else {
        logger.info(`[MODERATION] Attempting to auto-like comment ${commentDoc.youtubeId}`);
        const result = await likeComment(youtube, commentDoc.youtubeId);
        likeStatus = result.status;
        likeError = result.reason;
        autoLiked = result.success;
        if (autoLiked) {
          aiActionTaken = true;
        }
      }
    }

    // Auto-Reply logic (replies to all good comments, never reply to toxic/spam/deleted comments)
    let replyStatus = commentDoc.replyStatus || 'none';
    let replyError = commentDoc.replyError || null;
    let replyText = commentDoc.replyText || null;
    let suggestedReply = commentDoc.suggestedReply || aiResult.suggestedReply;

    const isNormalComment = !isToxicOrBad && status !== 'deleted' && status !== 'flagged' && !wasHidden;

    if (isNormalComment) {
      if (channel.apiKey) {
        replyStatus = 'failed';
        replyError = 'Authentication via API Key does not permit write actions (OAuth required)';
        logger.warn(`[REPLY] API Key channel. Cannot reply to comment ${commentDoc.youtubeId}.`);
      } else {
        // Atomic distributed lock check/set to prevent duplicate replies
        const lockedComment = await Comment.findOneAndUpdate(
          { _id: commentDoc._id, replyStatus: { $nin: ['sent', 'pending'] } },
          { $set: { replyStatus: 'pending' } },
          { returnDocument: 'after' }
        );

        if (!lockedComment) {
          logger.info(`[REPLY] Comment ${commentDoc.youtubeId} already has a reply sent or pending. Skipping reply.`);
        } else {
          // Double check AutoReplyLog first to prevent any duplicate posting in same or parallel cycle
          const existing = await AutoReplyLog.findOne({ commentId: commentDoc.youtubeId });
          if (existing && (existing.status === 'success' || existing.status === 'pending')) {
            logger.warn(`[REPLY] Comment ${commentDoc.youtubeId} already has a reply logged/pending in AutoReplyLog. Syncing state and skipping.`);
            await Comment.updateOne(
              { _id: commentDoc._id },
              {
                $set: {
                  replyStatus: existing.status === 'success' ? 'sent' : 'pending',
                  replyText: existing.status === 'success' ? existing.replyText : null,
                  aiActionTaken: true
                }
              }
            );
            return;
          }

          logger.info(`[REPLY] Sending auto-reply to comment ${commentDoc.youtubeId}`);
          const repRes = await generateAndPostAutoReply({
            youtube,
            parentId: targetParentId,
            commentText: commentDoc.text,
            commentId: commentDoc.youtubeId,
            videoId: commentDoc.videoId,
            userId: channel.userId,
            userKey
          });
          logger.info(`[REPLY] Auto-reply API response: ${JSON.stringify(repRes)}`);

          if (repRes.success) {
            replyStatus = 'sent';
            aiActionTaken = true;
            replyText = repRes.replyText;
            suggestedReply = repRes.replyText;
            // ── FIX #3: Atomically mark the original comment as replied to ───────
            // Use findOneAndUpdate so concurrent workers cannot both proceed past this
            await Comment.findOneAndUpdate(
              { _id: commentDoc._id, hasReplied: { $ne: true } },
              {
                $set: {
                  hasReplied: true,
                  repliedAt: new Date()
                }
              }
            );
            logger.info(`[REPLY] [FIX #3] Marked comment ${commentDoc.youtubeId} hasReplied=true to prevent duplicates. (commentProcessingService.mjs)`);
            // ── END FIX #3 ──────────────────────────────────────────────────────

            // ── FIX #2: Save the bot reply comment in MongoDB with isBotReply=true ─
            // This prevents the next sync from picking up and moderating this reply.
            if (repRes.newCommentId) {
              try {
                await Comment.findOneAndUpdate(
                  { youtubeId: repRes.newCommentId, userId: channel.userId },
                  {
                    $setOnInsert: {
                      userId: channel.userId,
                      youtubeId: repRes.newCommentId,
                      channelId: channel.channelId,
                      videoId: commentDoc.videoId,
                      text: replyText,
                      author: 'Bot (Auto-Reply)',
                      authorChannelId: channel.channelId,
                      publishedAt: new Date(),
                    },
                    $set: {
                      isBotReply: true,
                      hasReplied: false,
                      status: 'approved',
                      aiActionTaken: true,
                      aiStatus: 'completed',
                      classification: 'bot_reply',
                      moderationStatus: 'safe',
                      actionTaken: 'skip_bot',
                    }
                  },
                  { upsert: true, new: true }
                );
                logger.info(`[REPLY] [FIX #2] Saved bot reply ${repRes.newCommentId} in MongoDB with isBotReply=true. (commentProcessingService.mjs)`);
              } catch (botSaveErr) {
                logger.error(`[REPLY] [FIX #2] Failed to save bot reply comment in MongoDB: ${botSaveErr.message}`);
              }
            }
            // ── END FIX #2 ──────────────────────────────────────────────────────

            await logAutomation(channel.userId, 'comment_reply', `Auto-replied to comment: ${replyText}`, { commentId: commentDoc.youtubeId, apiResponse: repRes });
          } else {
            replyStatus = 'failed';
            replyError = repRes.reason;
            suggestedReply = repRes.replyText || suggestedReply;
          }
        }
      }
    }

    // Auto-Leads & GoWhats push (under Safe Transactions)
    const whatsappNumber = detectWhatsAppNumber(commentDoc.text);
    const isLeadIntent = rawAnalysis.buyingIntent === true || rawAnalysis.customer === true || aiResult.lead?.isLead === true;

    if (status !== 'deleted' && (whatsappNumber || isLeadIntent)) {
      await runInTransaction(async (session) => {
        const phoneToUse = whatsappNumber || rawAnalysis.whatsappNumber || rawAnalysis.phoneNumber || aiResult.lead?.phone;
        const emailToUse = rawAnalysis.email || aiResult.lead?.email;
        const intentToUse = rawAnalysis.buyingIntent ? 'Purchase Intent' : (rawAnalysis.customer ? 'Interested' : 'Interest');
        const notesText = `Product: ${rawAnalysis.productInterest || 'General'} | Language: ${rawAnalysis.detectedLanguage || 'English'} | Emotion: ${rawAnalysis.emotion || 'unknown'} | Urgency: ${rawAnalysis.urgency || 'low'}`;

        logger.info(`[LEADS] Creating lead for comment ${commentDoc.youtubeId} by ${commentDoc.author}`);
        const { lead, isDuplicate } = await createLead({
          userId: channel.userId,
          channelId: channel.channelId,
          videoId: commentDoc.videoId,
          commentId: commentDoc.youtubeId,
          authorName: commentDoc.author,
          originalComment: commentDoc.text,
          whatsappNumber: phoneToUse || 'None',
          email: emailToUse || null,
          intent: intentToUse,
          productInterest: rawAnalysis.productInterest || 'General',
          language: rawAnalysis.detectedLanguage || 'English',
          notes: notesText,
        }, { session });

        if (!isDuplicate && !channel.apiKey && phoneToUse && phoneToUse !== 'None') {
          // Hide the comment to protect phone number privacy
          logger.info(`[LEADS] Hiding comment ${commentDoc.youtubeId} to protect user privacy (WhatsApp number detected)`);
          const hideRes = await hideComment(youtube, commentDoc.youtubeId);
          if (hideRes.success) {
            lead.isHidden = true;
            status = 'flagged';
            wasHidden = true;
          }

          const user = await User.findById(channel.userId);
          const productLink = user?.productLink || process.env.PRODUCT_LINK || 'https://techvaseegrah.com';
          const messageTemplate = `Hi ${commentDoc.author},\n\nThank you for showing interest in our product! 🚀\n\nHere is the link for more details: ${productLink}\n\nOur team will also reach out to you shortly. Feel free to reply here if you have any questions!`;

          const decryptedGoWhatsKey = user?.gowhatsApiKey ? decrypt(user.gowhatsApiKey) : null;
          logger.info(`[LEADS] Sending WhatsApp alert to ${phoneToUse}`);
          const waRes = await sendWhatsAppMessage(phoneToUse, messageTemplate, 3, decryptedGoWhatsKey, user?.gowhatsUrl);

          const waLog = new GoWhatsLog({
            userId: channel.userId,
            recipientNumber: phoneToUse,
            message: messageTemplate,
            status: waRes.success ? 'sent' : 'failed',
            error: waRes.success ? null : waRes.error
          });
          await waLog.save({ session });

          if (waRes.success) {
            lead.status = 'sent';
            lead.whatsappSent = true;
            logger.info(`[LEADS] WhatsApp alert sent successfully to ${phoneToUse}`);
          } else {
            lead.status = 'failed';
            lead.errorLog = waRes.error;
            logger.error(`[LEADS] WhatsApp alert failed: ${waRes.error}`);
          }

          await lead.save({ session });
        }
      });
    }

    // Save final classification updates
    logger.info(`[MODERATION] Saving AI analysis and actions in MongoDB for comment ${commentDoc.youtubeId}`);
    const updatedComment = await Comment.findOneAndUpdate(
      { userId: channel.userId, youtubeId: commentDoc.youtubeId },
      {
        sentiment: aiResult.sentiment,
        toxicityScore: aiResult.toxicityScore,
        confidence: aiResult.confidence,
        language: aiResult.language,
        detectedWords: aiResult.detectedWords,
        status: status,
        autoLiked: autoLiked,
        deleteFailed,
        deleteError: deleteErrorReason,
        deleteReason,
        deletedAt,
        likeStatus: likeStatus !== 'none' ? likeStatus : 'none',
        likeError: likeError,
        aiActionTaken: true, // Mark classification complete
        classification,
        suggestedReply: suggestedReply,
        replyText,
        replyStatus,
        replyError,
        note: wasHidden ? 'Auto-hidden for privacy/compliance' : '',
        moderationStatus,
        aiStatus,
        actionTaken,
        moderationReason
      },
      { returnDocument: 'after' }
    );
    logger.info("MongoDB updated");

    // Broadcast update using Socket.IO
    if (io && updatedComment) {
      const roomName = channel.userId.toString();
      logger.info(`[SOCKET.IO] Broadcasting comment analysis update for room: ${roomName}`);
      io.to(roomName).emit('live_activity', {
        ...updatedComment.toObject(),
        id: updatedComment._id,
        type: status === 'deleted' ? 'delete' : (autoLiked ? 'like' : 'new_comment')
      });
      io.to(roomName).emit('new_comment_analyzed', updatedComment);
      io.to(roomName).emit('stats_updated');
      logger.info("Socket event emitted");
    }
  } catch (error) {
    logger.error(`Error processing single comment ${commentDoc.youtubeId}:`, error);
  }
};

/**
 * Main worker pipeline. Triggered by scheduled cron job or auth callback.
 */
export const processComments = async (channel, tokens = null, apiKey = null, io = null, videoId = null) => {
  try {
    if (channel.channelId && channel.channelId.startsWith('PENDING_')) {
      logger.info(`[SYNC] Skipping pending channel: ${channel.channelId} (No YouTube API calls will be made)`);
      return;
    }

    let latestChannel = await Channel.findById(channel._id);
    if (!latestChannel) {
      logger.error(`[SYNC] Channel not found in database: ${channel._id}`);
      return;
    }
    if (latestChannel.reconnectRequired) {
      logger.info(`[SYNC] Skipping reconnect-required channel: ${latestChannel.title || latestChannel.channelId}`);
      return;
    }

    // Quota backoff check
    const nextSyncTime = getNextSyncTime(latestChannel._id.toString());
    if (nextSyncTime && new Date() < nextSyncTime) {
      logger.info(`[SYNC] Skipping channel ${latestChannel.title || latestChannel.channelId} due to active quota backoff. Next sync allowed after ${nextSyncTime.toISOString()}`);
      return;
    }

    // Cooldown check (5 minutes / 300,000 ms) - bypassed if videoId is provided (manual sync)
    if (!videoId && latestChannel.lastSyncedAt) {
      const timeSinceLastSync = Date.now() - latestChannel.lastSyncedAt.getTime();
      if (timeSinceLastSync < 300000) {
        logger.info(`[SYNC] Skipping channel ${latestChannel.title || latestChannel.channelId} - synced recently (${Math.round(timeSinceLastSync / 1000)}s ago).`);
        return;
      }
    }

    const hasTokens = tokens && (tokens.access_token || tokens.refresh_token);
    const hasChannelCreds = latestChannel.apiKey || latestChannel.accessToken;
    
    if (!apiKey && !hasTokens && !hasChannelCreds) {
      logger.warn(`Channel ${latestChannel.channelId || latestChannel.title} has no credentials (accessToken or apiKey) saved. Sync skipped.`);
      return;
    }

    logger.info(`[SYNC] Starting comment/video sync pipeline for channel: ${latestChannel.title} (ID: ${latestChannel.channelId})`);

    let youtube;
    if (apiKey) {
      const decryptedApiKey = decrypt(apiKey);
      youtube = getYouTubeClientWithApiKey(decryptedApiKey);
    } else if (tokens) {
      const decryptedTokens = {
        access_token: decrypt(tokens.access_token),
        refresh_token: decrypt(tokens.refresh_token),
        expiry_date: tokens.expiry_date
      };
      youtube = getYouTubeClient(decryptedTokens, async (newTokens) => {
        logger.info(`[SYNC] Tokens refreshed for channel ${latestChannel.channelId}`);
        await Channel.findOneAndUpdate({ channelId: latestChannel.channelId, userId: latestChannel.userId }, {
          accessToken: encrypt(newTokens.access_token),
          refreshToken: encrypt(newTokens.refresh_token || decrypt(latestChannel.refreshToken)),
          expiryDate: newTokens.expiry_date
        }, { returnDocument: 'after' });
      }, latestChannel._id);
    } else {
      if (latestChannel.apiKey) {
        youtube = getYouTubeClientWithApiKey(decrypt(latestChannel.apiKey));
      } else {
        youtube = getYouTubeClient({
          access_token: decrypt(latestChannel.accessToken),
          refresh_token: decrypt(latestChannel.refreshToken),
          expiry_date: latestChannel.expiryDate
        }, async (newTokens) => {
          logger.info(`[SYNC] Tokens refreshed for channel ${latestChannel.channelId}`);
          await Channel.findOneAndUpdate({ channelId: latestChannel.channelId, userId: latestChannel.userId }, {
            accessToken: encrypt(newTokens.access_token),
            refreshToken: encrypt(newTokens.refresh_token || decrypt(latestChannel.refreshToken)),
            expiryDate: newTokens.expiry_date
          }, { returnDocument: 'after' });
        }, latestChannel._id);
      }
    }
    if (youtube) {
      logger.info("YouTube client initialized");
    }

    let user = await User.findById(channel.userId);
    if (!user) {
      const adminUser = await User.findOne({ email: 'admin@youtubeai.test' });
      if (adminUser) {
        channel.userId = adminUser._id;
        await Channel.updateOne({ _id: channel._id }, { $set: { userId: adminUser._id } });
        user = adminUser;
        logger.info(`[SYNC] Re-linked orphaned channel ${channel.channelId} to system admin ${adminUser._id}`);
      }
    }

    if (!user) {
      logger.error(`[SYNC] User not found for channel ${channel.channelId}`);
      return;
    }

    logger.info("User loaded successfully");
    
    const userSettings = user.settings || { autoMod: true, autoLike: true, confidenceThreshold: 85 };
    const userKey = user.openaiApiKey ? decrypt(user.openaiApiKey) : null;

    // ──────────────────────────────────────────────────────────
    // 1. SELF-HEALING / RETRY FAILED JOBS LOOP
    // ──────────────────────────────────────────────────────────
    try {
      if (!apiKey && !channel.apiKey) {
        // Retry failed deletions
        const failedDeletions = await Comment.find({ userId: channel.userId, status: 'flagged', deleteFailed: true }).limit(5);
        for (const fc of failedDeletions) {
          logger.info(`[RETRY] Retrying failed deletion for comment: ${fc.youtubeId}`);
          const delRes = await deleteCommentFromYouTube(youtube, fc.youtubeId);
          if (delRes.success) {
            fc.status = delRes.action === 'hide' ? 'flagged' : 'deleted';
            fc.deleteFailed = false;
            fc.deleteError = null;
            fc.aiActionTaken = true;
            fc.deleteReason = `Retry: Auto-${delRes.action}d comment`;
            fc.deletedAt = new Date();
            fc.actionTaken = delRes.action;
            fc.moderationStatus = delRes.action === 'hide' ? 'hidden' : 'deleted';
            await fc.save();
            await logAutomation(channel.userId, `comment_${delRes.action}`, `Retried and successfully ${delRes.action}d comment: ${fc.youtubeId}`, { commentId: fc.youtubeId, apiResponse: delRes });
          } else {
            fc.deleteError = delRes.reason;
            await fc.save();
          }
        }

        // Retry failed replies
        const failedReplies = await Comment.find({ userId: channel.userId, replyStatus: 'failed' }).limit(5);
        for (const fr of failedReplies) {
          logger.info(`[RETRY] Retrying failed reply for comment: ${fr.youtubeId}`);
          const targetParentId = fr.youtubeId.includes('.') ? fr.youtubeId.split('.')[0] : fr.youtubeId;

          // Double check AutoReplyLog first before retrying
          const existing = await AutoReplyLog.findOne({ commentId: fr.youtubeId });
          if (existing && (existing.status === 'success' || existing.status === 'pending')) {
            logger.warn(`[RETRY] Comment ${fr.youtubeId} already has a reply logged/pending in AutoReplyLog. Syncing state and skipping.`);
            if (existing.status === 'success') {
              fr.replyStatus = 'sent';
              fr.replyText = existing.replyText;
              fr.aiActionTaken = true;
              await fr.save();
            }
            continue;
          }

          // Create a pending lock
          try {
            await AutoReplyLog.create({
              commentId: fr.youtubeId,
              videoId: fr.videoId,
              userId: channel.userId,
              detectedLanguage: fr.language || 'English',
              replyText: fr.suggestedReply,
              status: 'pending'
            });
          } catch (lockErr) {
            logger.warn(`[RETRY] Could not acquire lock for comment ${fr.youtubeId} during retry. Skipping.`);
            continue;
          }

          const repRes = await replyToComment(youtube, targetParentId, fr.suggestedReply);
          if (repRes.success) {
            fr.replyStatus = 'sent';
            fr.replyError = null;
            fr.aiActionTaken = true;
            fr.replyText = fr.suggestedReply;
            await fr.save();

            // Mark lock as success
            await AutoReplyLog.updateOne(
              { commentId: fr.youtubeId },
              { $set: { status: 'success' } }
            );

            await logAutomation(channel.userId, 'comment_reply', `Retried and successfully replied to comment: ${fr.youtubeId}`, { commentId: fr.youtubeId, apiResponse: repRes });
          } else {
            fr.replyError = repRes.reason;
            await fr.save();

            // Delete pending lock so it can be retried again
            await AutoReplyLog.deleteOne({ commentId: fr.youtubeId });
          }
        }

        // Retry failed leads alerts
        if (user.gowhatsApiKey && user.gowhatsUrl) {
          const failedLeads = await Lead.find({ userId: channel.userId, status: 'failed' }).limit(5);
          for (const fl of failedLeads) {
            logger.info(`[RETRY] Retrying failed WhatsApp alert for lead: ${fl.whatsappNumber}`);
            const productLink = user.productLink || process.env.PRODUCT_LINK || 'https://techvaseegrah.com';
            const msg = `Hi ${fl.authorName},\n\nThank you for showing interest in our product! 🚀\n\nHere is the link for more details: ${productLink}\n\nOur team will also reach out to you shortly. Feel free to reply here if you have any questions!`;
            
            const decryptedGoWhatsKey = decrypt(user.gowhatsApiKey);
            const waRes = await sendWhatsAppMessage(fl.whatsappNumber, msg, 1, decryptedGoWhatsKey, user.gowhatsUrl);
            
            const log = new GoWhatsLog({
              userId: channel.userId,
              recipientNumber: fl.whatsappNumber,
              message: msg,
              status: waRes.success ? 'sent' : 'failed',
              error: waRes.success ? null : waRes.error
            });
            await log.save();

            if (waRes.success) {
              fl.status = 'sent';
              fl.whatsappSent = true;
              fl.errorLog = null;
              await fl.save();
            } else {
              fl.errorLog = waRes.error;
              await fl.save();
            }
          }
        }
      }
    } catch (retryErr) {
      logger.error('Error in retry loop:', retryErr);
    }

    // ──────────────────────────────────────────────────────────
    // 2. CHANNELS SYNC SEQUENCE
    // ──────────────────────────────────────────────────────────
    latestChannel = await Channel.findById(channel._id);
    
    // Check if initial full sync is in progress
    if (latestChannel.lastSyncedAt && latestChannel.lastSyncedAt.getTime() === 0) {
      logger.info(`Initial Full Sync currently in progress for channel: ${channel.title}. Sync call skipped.`);
      return;
    }

    // If channel has never been synced, perform INITIAL FULL SYNC
    if (!latestChannel.lastSyncedAt) {
      // Set lock indicator (Jan 1, 1970 00:00:00)
      await Channel.findByIdAndUpdate(channel._id, { lastSyncedAt: new Date(0) });
      logger.info(`[INITIAL SYNC] Starting Initial Full Sync for channel: ${channel.title} (ID: ${channel.channelId})`);

      try {
        // Step A: Fetch ALL existing videos and save them to MongoDB
        logger.info("Fetching videos");
        const allVideos = await fetchAllVideos(youtube, channel.channelId);
        logger.info(`[INITIAL SYNC] Fetched ${allVideos.length} videos from YouTube for channel ${channel.title}`);

        for (const v of allVideos) {
          await Video.findOneAndUpdate(
            { userId: channel.userId, videoId: v.videoId },
            {
              userId: channel.userId,
              channelId: channel.channelId,
              videoId: v.videoId,
              title: v.title,
              description: v.description,
              thumbnail: v.thumbnail,
              publishedAt: v.publishedAt
            },
            { upsert: true }
          );
        }

        // Step B: Fetch ALL existing comments and replies for every video
        let totalCommentsImported = 0;
        logger.info("Fetching comments");
        for (const v of allVideos) {
          const videoComments = await fetchAllCommentsAndRepliesForVideo(youtube, v.videoId);
          
          for (const c of videoComments) {
            const existing = await Comment.findOne({ userId: channel.userId, youtubeId: c.youtubeId });
            if (!existing) {
              const newComment = new Comment({
                userId: channel.userId,
                youtubeId: c.youtubeId,
                channelId: channel.channelId,
                videoId: c.videoId,
                text: c.text,
                author: c.author,
                authorProfileImageUrl: c.authorProfileImageUrl,
                // Gap fix: same authorChannelId capture that the recurring sync already does —
                // needed so processSingleComment can detect and skip bot-authored replies.
                authorChannelId: c.authorChannelId || null,
                publishedAt: c.publishedAt,
                status: 'pending',
                aiActionTaken: false
              });
              await newComment.save();
              totalCommentsImported++;
            }
          }
        }
        logger.info(`[INITIAL SYNC] Completed comment import. Imported ${totalCommentsImported} new comments as PENDING.`);

        // Step C: Update lastSyncedAt to current date (marking sync complete)
        await Channel.findByIdAndUpdate(channel._id, { lastSyncedAt: new Date() });
        logger.info(`[INITIAL SYNC] Initial Full Sync Completed for Channel: ${channel.title}`);
      } catch (syncErr) {
        logger.error(`[INITIAL SYNC] Failed sync for channel ${channel.title}:`, syncErr);
        // Release lock on sync error to retry
        await Channel.findByIdAndUpdate(channel._id, { lastSyncedAt: null });
        if (isQuotaError(syncErr)) throw syncErr;
        return;
      }
    } else {
      // ──────────────────────────────────────────────────────────
      // NORMAL RECURRING SCAN (Every 30 seconds)
      // ──────────────────────────────────────────────────────────
      if (!videoId) {
        // Sync new uploads
        try {
          logger.info("Fetching videos");
          const fetchedVideos = await fetchVideos(youtube, channel.channelId, channel.uploadsPlaylistId);
          for (const v of fetchedVideos) {
            const existingVideo = await Video.findOne({ userId: channel.userId, videoId: v.videoId });
            if (!existingVideo) {
              logger.info(`[SYNC] New video detected: ${v.title} (ID: ${v.videoId})`);
              const analysisResult = await analyzeVideo(v.title, v.description, [], '', userKey);
              const newVideo = new Video({
                userId: channel.userId,
                channelId: channel.channelId,
                videoId: v.videoId,
                title: v.title,
                description: v.description,
                thumbnail: v.thumbnail,
                publishedAt: v.publishedAt,
                analyzed: true,
                analysis: {
                  tags: analysisResult.tags || [],
                  category: analysisResult.category || 'unknown',
                  language: analysisResult.language || 'unknown',
                  keywords: analysisResult.keywords || [],
                  sentiment: analysisResult.sentiment || 'neutral',
                  topic: analysisResult.topic || 'unknown',
                  seoQuality: analysisResult.seoQuality || 'Medium',
                  summary: analysisResult.summary || '',
                  analyzedAt: new Date()
                }
              });
              await newVideo.save();
              await logAutomation(channel.userId, 'video_analysis', `Analyzed new video: ${v.title}`, { videoId: v.videoId });
            }
          }
        } catch (err) {
          logger.error('Error syncing new videos:', err);
          if (isQuotaError(err)) throw err;
        }
      }

      // Sync latest 50 comments (to monitor new comments)
      try {
        logger.info("Fetching comments");
        const comments = await fetchLatestComments(youtube, channel.channelId, 50, videoId);
        if (comments && comments.length > 0) {
          for (const c of comments) {
            const existing = await Comment.findOne({ userId: channel.userId, youtubeId: c.youtubeId });
            if (!existing) {
              const newComment = new Comment({
                userId: channel.userId,
                youtubeId: c.youtubeId,
                channelId: channel.channelId,
                videoId: c.videoId,
                text: c.text,
                author: c.author,
                authorProfileImageUrl: c.authorProfileImageUrl,
                // FIX #2: Save the comment author's channel ID so the moderation
                // pipeline can detect and skip bot-authored replies.
                authorChannelId: c.authorChannelId || null,
                publishedAt: c.publishedAt,
                status: 'pending',
                aiActionTaken: false
              });
              await newComment.save();
            }
          }
        }
      } catch (err) {
        logger.error('Error syncing latest comments:', err);
        if (isQuotaError(err)) throw err;
      }
    }

    // ──────────────────────────────────────────────────────────
    // 3. PROCESS UNPROCESSED COMMENTS USING DEEPSEEK
    // ──────────────────────────────────────────────────────────
    const unprocessed = await Comment.find({ 
      userId: channel.userId, 
      channelId: channel.channelId, 
      aiActionTaken: false,
      aiStatus: { $nin: ['processing', 'completed'] }
    }).sort({ publishedAt: -1 }).limit(10);

    if (unprocessed.length > 0) {
      logger.info(`[DEEPSEEK PROCESSOR] Analyzing ${unprocessed.length} pending comments for channel: ${channel.title}...`);
      for (const cDoc of unprocessed) {
        // Atomic processing lock to prevent concurrent duplicate processing
        const lockedDoc = await Comment.findOneAndUpdate(
          { _id: cDoc._id, aiActionTaken: false, aiStatus: { $nin: ['processing', 'completed'] } },
          { $set: { aiStatus: 'processing' } },
          { returnDocument: 'after' }
        );

        if (!lockedDoc) {
          logger.info(`[DEEPSEEK PROCESSOR] Comment ${cDoc.youtubeId} is already being processed by another worker. Skipping.`);
          continue;
        }

        try {
          await processSingleComment(youtube, channel, userKey, userSettings, lockedDoc, io);
        } catch (procErr) {
          logger.error(`[DEEPSEEK PROCESSOR] Failed to process comment ${lockedDoc.youtubeId}:`, procErr);
          await Comment.updateOne(
            { _id: lockedDoc._id },
            { $set: { aiStatus: 'failed' } } // Reset status so it can retry
          );
        }

        // Sleep 100ms between calls to control rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Emit stats updates
    if (io) {
      io.to(channel.userId.toString()).emit('stats_updated');
    }

    // Update lastSyncedAt to now, marking sync successful, and clear quota backoff
    await Channel.updateOne({ _id: channel._id }, { $set: { lastSyncedAt: new Date() } });
    clearQuotaBackoff(channel._id.toString());
  } catch (error) {
    if (isQuotaError(error)) {
      logger.warn(`[SYNC] Quota exceeded for channel ${channel.title || channel.channelId}: ${error.message}`);
      handleQuotaError(channel._id.toString());
    } else {
      logger.error('Worker error:', error);
    }
  }
};
