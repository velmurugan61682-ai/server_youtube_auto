import mongoose from 'mongoose'; // Mongoose database connector
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import User from '../models/User.mjs';
import Lead from '../models/Lead.mjs';
import Video from '../models/Video.mjs';
import GoWhatsLog from '../models/GoWhatsLog.mjs';
import AutomationLog from '../models/AutomationLog.mjs';
import logger from '../utils/logger.mjs';
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
  fetchAllCommentsAndRepliesForVideo
} from './youtubeService.mjs';
import { classifyComment, analyzeVideo } from './aiService.mjs';
import { detectWhatsAppNumber, createLead } from './leadService.mjs';
import { sendWhatsAppMessage } from './gowhatsService.mjs';
import { encrypt, decrypt } from '../utils/cryptoHelper.mjs';

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

    // Auto-Reply logic (replies ONLY to genuine questions or buying-intent comments, never reply to toxic/spam/deleted comments)
    let replyStatus = 'none';
    let replyError = null;
    let replyText = null;

    const isQuestionOrLead = !!(rawAnalysis.question || rawAnalysis.buyingIntent || classification === 'Question' || classification === 'Lead');
    const isNormalComment = !isToxicOrBad && status !== 'deleted' && status !== 'flagged' && !wasHidden;
    const hasSuggestedReply = !!aiResult.suggestedReply;

    if (isNormalComment && isQuestionOrLead && hasSuggestedReply) {
      if (channel.apiKey) {
        replyStatus = 'failed';
        replyError = 'Authentication via API Key does not permit write actions (OAuth required)';
        logger.warn(`[REPLY] API Key channel. Cannot reply to comment ${commentDoc.youtubeId}.`);
      } else {
        // Atomic distributed lock check/set to prevent duplicate replies
        const lockedComment = await Comment.findOneAndUpdate(
          { _id: commentDoc._id, replyStatus: { $nin: ['sent', 'pending'] } },
          { $set: { replyStatus: 'pending' } },
          { new: true }
        );

        if (!lockedComment) {
          logger.info(`[REPLY] Comment ${commentDoc.youtubeId} already has a reply sent or pending. Skipping reply.`);
        } else {
          logger.info(`[REPLY] Sending auto-reply to comment ${commentDoc.youtubeId}`);
          const repRes = await replyToComment(youtube, targetParentId, aiResult.suggestedReply);
          logger.info(`[REPLY] Auto-reply API response: ${JSON.stringify(repRes)}`);

          if (repRes.success) {
            replyStatus = 'sent';
            aiActionTaken = true;
            replyText = aiResult.suggestedReply;
            await logAutomation(channel.userId, 'comment_reply', `Auto-replied to comment: ${replyText}`, { commentId: commentDoc.youtubeId, apiResponse: repRes });
          } else {
            replyStatus = 'failed';
            replyError = repRes.reason;
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
        suggestedReply: aiResult.suggestedReply,
        replyText,
        replyStatus,
        replyError,
        note: wasHidden ? 'Auto-hidden for privacy/compliance' : '',
        moderationStatus,
        aiStatus,
        actionTaken,
        moderationReason
      },
      { new: true }
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

    const hasTokens = tokens && (tokens.access_token || tokens.refresh_token);
    const hasChannelCreds = channel.apiKey || channel.accessToken;
    
    if (!apiKey && !hasTokens && !hasChannelCreds) {
      logger.warn(`Channel ${channel.channelId || channel.title} has no credentials (accessToken or apiKey) saved. Sync skipped.`);
      return;
    }

    logger.info(`[SYNC] Starting comment/video sync pipeline for channel: ${channel.title} (ID: ${channel.channelId})`);

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
        logger.info(`[SYNC] Tokens refreshed for channel ${channel.channelId}`);
        await Channel.findOneAndUpdate({ channelId: channel.channelId, userId: channel.userId }, {
          accessToken: encrypt(newTokens.access_token),
          refreshToken: encrypt(newTokens.refresh_token || decrypt(channel.refreshToken)),
          expiryDate: newTokens.expiry_date
        });
      });
    } else {
      if (channel.apiKey) {
        youtube = getYouTubeClientWithApiKey(decrypt(channel.apiKey));
      } else {
        youtube = getYouTubeClient({
          access_token: decrypt(channel.accessToken),
          refresh_token: decrypt(channel.refreshToken),
          expiry_date: channel.expiryDate
        }, async (newTokens) => {
          logger.info(`[SYNC] Tokens refreshed for channel ${channel.channelId}`);
          await Channel.findOneAndUpdate({ channelId: channel.channelId, userId: channel.userId }, {
            accessToken: encrypt(newTokens.access_token),
            refreshToken: encrypt(newTokens.refresh_token || decrypt(channel.refreshToken)),
            expiryDate: newTokens.expiry_date
          });
        });
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
          const repRes = await replyToComment(youtube, targetParentId, fr.suggestedReply);
          if (repRes.success) {
            fr.replyStatus = 'sent';
            fr.replyError = null;
            fr.aiActionTaken = true;
            fr.replyText = fr.suggestedReply;
            await fr.save();
            await logAutomation(channel.userId, 'comment_reply', `Retried and successfully replied to comment: ${fr.youtubeId}`, { commentId: fr.youtubeId, apiResponse: repRes });
          } else {
            fr.replyError = repRes.reason;
            await fr.save();
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
    const latestChannel = await Channel.findById(channel._id);
    
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
          const fetchedVideos = await fetchVideos(youtube, channel.channelId);
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
    }).sort({ publishedAt: -1 });

    if (unprocessed.length > 0) {
      logger.info(`[DEEPSEEK PROCESSOR] Analyzing ${unprocessed.length} pending comments for channel: ${channel.title}...`);
      for (const cDoc of unprocessed) {
        // Atomic processing lock to prevent concurrent duplicate processing
        const lockedDoc = await Comment.findOneAndUpdate(
          { _id: cDoc._id, aiActionTaken: false, aiStatus: { $nin: ['processing', 'completed'] } },
          { $set: { aiStatus: 'processing' } },
          { new: true }
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
  } catch (error) {
    logger.error('Worker error:', error);
  }
};
