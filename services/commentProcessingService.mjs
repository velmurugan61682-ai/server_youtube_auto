import mongoose from 'mongoose'; // Mongoose database connector
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import User from '../models/User.mjs';
import Lead from '../models/Lead.mjs';
import Video from '../models/Video.mjs';
import GoWhatsLog from '../models/GoWhatsLog.mjs';
import AutomationLog from '../models/AutomationLog.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import AutoLikeLog from '../models/AutoLikeLog.mjs';
import CommentAutomationRule from '../models/CommentAutomationRule.mjs';
import AutoReplyRule from '../models/AutoReplyRule.mjs';
import CommentAutomationLog from '../models/CommentAutomationLog.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import ModerationRule from '../models/ModerationRule.mjs';
import OpenAI from 'openai';
import logger from '../utils/logger.mjs';
import moment from 'moment-timezone';
import crypto from 'crypto';
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

// In-memory comment ID deduplication to prevent concurrent duplicate processing
const activeCommentsProcessing = new Set();

export const getNextSyncTime = (channelId) => {
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

export const handleQuotaError = (channelId) => {
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

export const clearQuotaBackoff = (channelId) => {
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

// Get OpenAI instance for DeepSeek custom key fallback
const getOpenAIClient = (userKey) => {
  let apiKey = userKey;
  if (!apiKey) {
    apiKey = (process.env.DEEPSEEK_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  }
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com'
  });
};

const callWithRetry = async (client, body, maxRetries = 1) => {
  let attempt = 0;
  while (true) {
    try {
      return await client.chat.completions.create(body);
    } catch (error) {
      const status = error.status || error.response?.status;
      const is402 = status === 402 || error.message?.includes('402') || error.message?.toLowerCase().includes('insufficient balance') || (error.response && error.response.status === 402);
      const isTemporary = !status || (status >= 500 && status <= 599) || error.message?.includes('timeout') || error.code === 'ETIMEDOUT';

      if (is402) {
        logger.error(`[DEEPSEEK] Insufficient balance error detected (402) in comment processing. Disabling AI status.`);
        global.isAiAvailable = false;
        throw error;
      }

      if (isTemporary && attempt < maxRetries) {
        attempt++;
        logger.warn(`[DEEPSEEK] API call failed with temporary error. Retrying attempt ${attempt}/${maxRetries} in 1s...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      throw error;
    }
  }
};

// Check if a comment matches a rule using AI intent
const checkAiIntent = async (commentText, keywords, ruleName, userKey) => {
  const client = getOpenAIClient(userKey);
  if (!client) return false;
  try {
    const prompt = `Evaluate if the following YouTube comment expresses an intent, interest, or question related to the topic: "${ruleName}" or these keywords: ${keywords.join(', ')}.
Comment: "${commentText}"

Respond with ONLY a JSON object:
{
  "intentMatched": boolean
}`;
    const response = await callWithRetry(client, {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });
    const result = JSON.parse(response.choices[0].message.content.trim());
    return !!result.intentMatched;
  } catch (err) {
    const is402 = err.status === 402 || err.message?.includes('402') || err.message?.toLowerCase().includes('insufficient balance') || (err.response && err.response.status === 402);
    if (is402) {
      logger.error('CRITICAL: DeepSeek API returned 402 Insufficient Balance during checkAiIntent. Marking AI as Unavailable.');
      global.isAiAvailable = false;
    } else {
      logger.error('Error in checkAiIntent:', err);
    }
    return false;
  }
};

// Generate reply with AI tone
const generateAiToneReply = async (commentText, tone, customTone, maxLength, userKey) => {
  const client = getOpenAIClient(userKey);
  if (!client) return 'Thank you for your comment!';
  try {
    const activeTone = tone === 'Custom' ? customTone : tone;
    const prompt = `You are replying to a YouTube comment on behalf of the channel owner.
Comment: "${commentText}"
Tone to use: ${activeTone}

Generate a reply in the exact same language and script (Tamil, Tanglish, or English) of the comment.
Keep the response warm, natural, helpful, and matching the requested tone.
Ensure the reply is brief and does not exceed ${maxLength || 200} characters.

Respond with ONLY a JSON object:
{
  "reply": "your generated reply text"
}`;
    const response = await callWithRetry(client, {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });
    const result = JSON.parse(response.choices[0].message.content.trim());
    return result.reply || 'Thank you for your feedback!';
  } catch (err) {
    const is402 = err.status === 402 || err.message?.includes('402') || err.message?.toLowerCase().includes('insufficient balance') || (err.response && err.response.status === 402);
    if (is402) {
      logger.error('CRITICAL: DeepSeek API returned 402 Insufficient Balance during generateAiToneReply. Marking AI as Unavailable.');
      global.isAiAvailable = false;
    } else {
      logger.error('Error in generateAiToneReply:', err);
    }
    return 'Thank you for your comment!';
  }
};

const generateDeepseekHumanReply = async (commentText, ruleBaseText, userKey) => {
  const client = getOpenAIClient(userKey);
  if (!client) return ruleBaseText || 'Thank you for your comment!';
  try {
    const prompt = `You are replying to a YouTube comment on behalf of the channel owner.
Comment: "${commentText}"
Base response guidance / template: "${ruleBaseText}"

Analyze and detect the exact language and script of the comment (e.g. Tamil script, Tanglish/Latin, Hindi script, Hinglish, Spanish, Malayalam, Telugu, English, etc.).
Generate a natural, human-like, conversational response that answers or acknowledges the comment in the EXACT SAME language and script as the comment.
- If the comment is in Tanglish (Tamil words written in English/Latin letters), reply in Tanglish!
- If the comment is in Hindi / Hinglish, reply in Hinglish or Hindi script matching the comment.
- If the comment is in Tamil script, reply in Tamil script.
- If the comment is in any other language, reply in that exact language and script.
Ensure the response incorporates the guidance from the base response template (if any), sounds completely natural, and does not exceed 200 characters.

Respond with ONLY a JSON object:
{
  "reply": "your generated reply text"
}`;
    const response = await callWithRetry(client, {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });
    const result = JSON.parse(response.choices[0].message.content.trim());
    return result.reply || ruleBaseText || 'Thank you for your comment!';
  } catch (err) {
    const is402 = err.status === 402 || err.message?.includes('402') || err.message?.toLowerCase().includes('insufficient balance') || (err.response && err.response.status === 402);
    if (is402) {
      logger.error('CRITICAL: DeepSeek API returned 402 Insufficient Balance during generateDeepseekHumanReply. Marking AI as Unavailable.');
      global.isAiAvailable = false;
    } else {
      logger.error('Error in generateDeepseekHumanReply:', err);
    }
    return ruleBaseText || 'Thank you for your comment!';
  }
};

// Helper to log automation actions and notify user (avoiding duplicates)
const createAutomationNotification = async (userId, actionType, description, details = null, io = null) => {
  try {
    // Prevent duplicate notifications within 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 300000);
    const duplicate = await AutomationLog.findOne({
      userId,
      actionType,
      description,
      createdAt: { $gt: fiveMinutesAgo }
    });

    if (duplicate) {
      logger.info(`[Notification] Skipped duplicate notification: "${description}"`);
      return;
    }

    const log = new AutomationLog({
      userId,
      actionType,
      description,
      details,
      timestamp: new Date()
    });
    await log.save();

    if (io) {
      const roomName = userId.toString();
      io.to(roomName).emit('automation_notification', {
        id: log._id,
        actionType,
        description,
        details,
        createdAt: log.createdAt
      });
      // Also broadcast stats update
      io.to(roomName).emit('stats_updated');
    }
  } catch (err) {
    logger.error(`[Notification] Error logging notification: ${err.message}`);
  }
};

// =========================================================================
// CENTRAL CATEGORY MAPPER
// =========================================================================
export const mapClassificationToRule = (classification, rawAnalysis = {}) => {
  const cls = (classification || '').toLowerCase().trim();
  const raw = rawAnalysis || {};

  if (raw.isLinkSpam) return 'linkSpam';
  if (raw.isDuplicate) return 'duplicateComments';

  if (
    ['hate', 'hate_speech', 'hate speech'].includes(cls) ||
    raw.hate || raw.hateSpeech
  ) {
    return 'hateSpeech';
  }

  if (
    ['abuse', 'threat', 'bullying', 'violence', 'harassment'].includes(cls) ||
    raw.abuse || raw.threat || raw.harassment
  ) {
    return 'abuse';
  }

  if (cls === 'scam' || raw.scam) {
    return 'scam';
  }

  if (
    ['adult', 'sexual', 'sexualcontent', 'sexual content'].includes(cls) ||
    raw.adult || raw.sexualContent || raw.sexual
  ) {
    return 'sexualContent';
  }

  if (
    ['spam', 'promotion', 'selfpromotion', 'advertisement', 'self promotion'].includes(cls) ||
    raw.spam || raw.selfPromotion || raw.advertisement
  ) {
    return 'spam';
  }

  if (
    ['toxic', 'profanity', 'bad_words', 'bad words', 'offensive', 'malicious_review', 'fake_review', 'offensive_review', 'fake review', 'offensive review'].includes(cls) ||
    raw.toxic || raw.profanity || raw.badWords || raw.offensive || raw.maliciousReview || raw.fakeReview || raw.offensiveReview
  ) {
    return 'toxic';
  }

  return 'safe';
};

// =========================================================================
// TEXT NORMALIZATION & HASHING
// =========================================================================
export const normalizeCommentText = (text) => {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ''); // Remove punctuation
};

export const generateTextHash = (normalizedText) => {
  return crypto.createHash('md5').update(normalizedText).digest('hex');
};

// =========================================================================
// DUPLICATE DETECTOR
// =========================================================================
export const checkDuplicateComment = async (userId, organizationId, channelId, videoId, text, currentCommentId) => {
  const normalized = normalizeCommentText(text);
  if (normalized.length < 10) {
    return false; // Too short to be duplicate spam
  }
  const textHash = generateTextHash(normalized);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const query = {
    userId,
    organizationId,
    channelId,
    videoId,
    textHash,
    createdAt: { $gte: twentyFourHoursAgo }
  };
  if (currentCommentId) {
    query._id = { $ne: currentCommentId };
  }

  const occurrences = await Comment.countDocuments(query);
  return occurrences >= 2;
};

// =========================================================================
// LINK SPAM DETECTOR
// =========================================================================
export const checkLinkSpam = (text, userSettings, channel) => {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = text.match(urlRegex);
  if (!urls || urls.length === 0) return false;

  const productDomain = userSettings.productLink ? new URL(userSettings.productLink).hostname : '';
  const channelDomain = channel.customUrl ? channel.customUrl : '';

  const whitelist = ['youtube.com', 'youtu.be', 'ChannelMate.com', 'gowhats.app', 'gowhats.com'];
  if (productDomain) whitelist.push(productDomain);

  const isViolating = urls.some(urlStr => {
    try {
      const parsedUrl = new URL(urlStr);
      const hostname = parsedUrl.hostname.toLowerCase();
      return !whitelist.some(domain => hostname === domain || hostname.endsWith('.' + domain));
    } catch (e) {
      return true; // Suspect URL
    }
  });

  return isViolating;
};

// =========================================================================
// LEAD KEYWORDS DETECTOR
// =========================================================================
export const checkLeadKeywordsMatched = (text, keywords) => {
  const normalizedComment = text.toLowerCase();
  return keywords.some(kw => {
    const kwLower = kw.toLowerCase().trim();
    if (!kwLower) return false;
    const escapedKw = kwLower.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedKw}\\b`, 'i');
    return regex.test(normalizedComment);
  });
};

// =========================================================================
// PROCESS SINGLE COMMENT PIPELINE
// =========================================================================
export const processSingleComment = async (youtube, channel, userKey, userSettings, commentDoc, io) => {
  // 1. Validate tenant and channel ownership
  const dbChannel = await Channel.findOne({
    channelId: commentDoc.channelId || channel.channelId,
    userId: channel.userId,
    organizationId: channel.organizationId
  });
  if (!dbChannel) {
    logger.warn(`[Pipeline] Channel ownership validation failed for comment ${commentDoc.youtubeId}`);
    return false;
  }

  // 2. Skip bot replies and child replies when unsupported
  const isReply = Boolean(commentDoc.parentCommentId || commentDoc.isReply);
  if (isReply) {
    logger.info(`[Pipeline] Comment ${commentDoc.youtubeId} is a child reply. Skipping.`);
    return false;
  }
  if (commentDoc.authorChannelId === channel.channelId || commentDoc.isBotReply) {
    logger.info(`[Pipeline] Comment ${commentDoc.youtubeId} is posted by the channel owner or bot. Skipping.`);
    return false;
  }

  // 3. Atomic duplicate-processing guard
  if (activeCommentsProcessing.has(commentDoc.youtubeId)) {
    logger.info(`[Pipeline] Comment ${commentDoc.youtubeId} is already being processed. Skipping.`);
    return false;
  }

  try {
    activeCommentsProcessing.add(commentDoc.youtubeId);

    // 4. Check existing Logs and restore missing comments
    const existingComment = await Comment.findOne({
      youtubeId: commentDoc.youtubeId,
      userId: channel.userId
    });

    const isAlreadyProcessedInDb = existingComment && (
      existingComment.isModerated ||
      existingComment.hasReplied ||
      existingComment.aiStatus === 'completed' ||
      existingComment.isBotReply
    );

    if (isAlreadyProcessedInDb) {
      logger.info(`[Pipeline] Comment ${commentDoc.youtubeId} already processed in DB. Skipping.`);
      return false;
    }

    // Check logs to see if it should be restored/recreated
    const mLog = await ModerationLog.findOne({
      commentId: commentDoc.youtubeId,
      userId: channel.userId,
      organizationId: channel.organizationId
    }).lean();

    const aLog = await CommentAutomationLog.findOne({
      commentId: commentDoc.youtubeId,
      userId: channel.userId,
      organizationId: channel.organizationId
    }).lean();

    const autoRepLog = await AutoReplyLog.findOne({
      commentId: commentDoc.youtubeId,
      userId: channel.userId
    }).lean();

    const hasLogRecord = mLog || aLog || autoRepLog;

    if (hasLogRecord) {
      logger.info(`[Pipeline] Restoring missing/unprocessed comment ${commentDoc.youtubeId} from logs.`);

      // Reconstruct fields based on log records
      const isModerated = !!mLog;
      const hasReplied = !!aLog || !!autoRepLog;

      let moderationAction = 'none';
      if (mLog) {
        moderationAction = mLog.action || mLog.executedAction || 'delete';
      }

      let status = 'approved';
      if (isModerated) {
        status = (moderationAction === 'delete' || moderationAction === 'deleted') ? 'deleted' : 'flagged';
      }

      const replyText = aLog?.replyText || autoRepLog?.replyText || null;
      const repliedAt = aLog?.createdAt || autoRepLog?.createdAt || new Date();

      const commentData = {
        userId: channel.userId,
        organizationId: channel.organizationId,
        youtubeId: commentDoc.youtubeId,
        commentId: commentDoc.youtubeId,
        channelId: channel.channelId,
        videoId: commentDoc.videoId,
        text: commentDoc.text,
        commentText: commentDoc.text,
        author: commentDoc.author || 'Anonymous',
        username: commentDoc.author || 'Anonymous',
        authorProfileImageUrl: commentDoc.authorProfileImageUrl || '',
        authorChannelId: commentDoc.authorChannelId || null,
        publishedAt: commentDoc.publishedAt,
        parentCommentId: commentDoc.parentCommentId || null,
        isReply: commentDoc.isReply || false,

        status,
        sentiment: 'neutral',
        isModerated,
        moderationAction,
        hasReplied,
        repliedAt: hasReplied ? repliedAt : undefined,
        replyText,
        replyStatus: hasReplied ? 'sent' : 'none',
        aiStatus: 'completed'
      };

      const restoredComment = await Comment.findOneAndUpdate(
        { userId: channel.userId, youtubeId: commentDoc.youtubeId },
        { $set: commentData },
        { upsert: true, returnDocument: 'after' }
      );

      logger.info(`[Pipeline] Successfully restored comment ${commentDoc.youtubeId} to DB (Status: ${status}).`);

      // Broadcast real-time Socket.IO updates if reconstructed
      if (io && restoredComment) {
        const roomName = channel.userId.toString();
        io.to(roomName).emit('live_activity', {
          ...restoredComment.toObject(),
          id: restoredComment._id,
          type: status === 'deleted' ? 'delete' : (status === 'flagged' ? 'hold' : 'new_comment')
        });
        io.to(roomName).emit('new_comment_analyzed', restoredComment);
        io.to(roomName).emit('stats_updated');
      }

      return false; // Skip rest of pipeline because it is already historically handled!
    }

    // 5. Load tenant moderation settings (per-channel ModerationRule, scoped by organizationId + channelId)
    const user = await User.findById(channel.userId);
    if (!user) {
      logger.error(`[Pipeline] User not found for ID ${channel.userId}`);
      return false;
    }

    let channelModRule = await ModerationRule.findOne({
      organizationId: channel.organizationId,
      channelId: channel.channelId
    }).lean();

    const tenantSettings = {
      autoMod: channelModRule ? channelModRule.autoMod : true,
      autoLike: user.settings ? (user.settings.autoLike !== undefined ? user.settings.autoLike : true) : true,
      smartAiReply: user.settings ? (user.settings.smartAiReply !== undefined ? user.settings.smartAiReply : true) : true,
      confidenceThreshold: channelModRule ? channelModRule.confidenceThreshold : (user.settings?.confidenceThreshold || 85),
      languages: user.settings?.languages || ['English', 'Tamil', 'Tanglish'],
      realTimeAlerts: user.settings?.realTimeAlerts !== undefined ? user.settings.realTimeAlerts : true,
      moderationAction: channelModRule ? channelModRule.action : (user.settings?.moderationAction || 'delete'),
      leadKeywords: user.settings?.leadKeywords || ['price', 'details', 'course', 'join', 'contact', 'phone', 'call', 'whatsapp', 'demo', 'fees'],
      moderationRules: channelModRule ? channelModRule.rules : {
        toxicDetection: true,
        spamDetection: true,
        hateSpeech: true,
        abuse: true,
        scam: true,
        sexualContent: true,
        duplicateComments: true,
        linkSpam: true
      }
    };

    // 6. Normalize comment
    const normalizedText = normalizeCommentText(commentDoc.text);
    const textHash = generateTextHash(normalizedText);

    // 6a. Persist comment as 'processing' immediately — MongoDB is source of truth.
    // If worker crashes during DeepSeek/YouTube API calls, the record still exists.
    try {
      await Comment.findOneAndUpdate(
        { userId: channel.userId, youtubeId: commentDoc.youtubeId },
        {
          $setOnInsert: {
            userId: channel.userId,
            organizationId: channel.organizationId,
            youtubeId: commentDoc.youtubeId,
            commentId: commentDoc.youtubeId,
            channelId: channel.channelId,
            videoId: commentDoc.videoId,
            text: commentDoc.text,
            commentText: commentDoc.text,
            author: commentDoc.author || 'Anonymous',
            username: commentDoc.author || 'Anonymous',
            authorProfileImageUrl: commentDoc.authorProfileImageUrl || '',
            authorChannelId: commentDoc.authorChannelId || null,
            publishedAt: commentDoc.publishedAt,
            parentCommentId: commentDoc.parentCommentId || null,
            isReply: commentDoc.isReply || false,
            status: 'processing',
            aiStatus: 'pending',
            sentiment: 'neutral',
            textHash
          }
        },
        { upsert: true }
      );
    } catch (initSaveErr) {
      logger.error(`[Pipeline] Failed initial processing save for comment ${commentDoc.youtubeId}: ${initSaveErr.message}`);
    }

    // 7. AI and local moderation analysis
    const confidenceThresholdDecimal = (tenantSettings.confidenceThreshold || 85) / 100;
    const aiResult = await classifyComment(commentDoc.text, userKey);
    const classification = aiResult.classification || 'Neutral';
    const rawAnalysis = aiResult.rawAnalysis || {};

    const confidence = aiResult.confidence || 0;
    const isConfident = confidence >= confidenceThresholdDecimal;

    // Local Checks
    const isDuplicateLocal = await checkDuplicateComment(
      channel.userId,
      channel.organizationId,
      channel.channelId,
      commentDoc.videoId,
      commentDoc.text,
      commentDoc._id
    );
    if (isDuplicateLocal) {
      rawAnalysis.isDuplicate = true;
    }

    const isLinkSpamLocal = checkLinkSpam(commentDoc.text, tenantSettings, channel);
    if (isLinkSpamLocal) {
      rawAnalysis.isLinkSpam = true;
    }

    // 8. Evaluate enabled moderation rules
    const matchedCategory = mapClassificationToRule(classification, rawAnalysis);

    let isUnsafe = false;
    if (aiResult.isToxic === true && isConfident) {
      isUnsafe = true;
    } else if (matchedCategory !== 'safe' && isConfident) {
      const ruleName = `${matchedCategory}Detection`;
      if (tenantSettings.moderationRules[ruleName]) {
        isUnsafe = true;
      }
    }

    const needsManualReview = !isUnsafe && !isConfident && (aiResult.isToxic === true || matchedCategory !== 'safe');

    let moderationActionTaken = false;
    let replyStatus = 'none';
    let leadStatus = 'none';
    let executedAction = 'none';
    let status = needsManualReview ? 'moderate' : 'approved';
    let wasHidden = false;
    let deleteReason = null;
    let deletedAt = null;
    let moderationStatus = needsManualReview ? 'needsReview' : 'safe';
    let deleteFailed = false;
    let deleteErrorReason = null;

    // 9. If unsafe: Delete or hold for review
    if (isUnsafe) {
      moderationActionTaken = true;
      const modAction = tenantSettings.moderationAction || 'delete';

      if (channel.apiKey) {
        status = 'flagged';
        moderationStatus = 'heldForReview';
        executedAction = 'hold';
        deleteFailed = true;
        deleteErrorReason = 'Authentication via API Key does not permit write actions (OAuth required)';
      } else {
        if (modAction === 'delete') {
          const delRes = await deleteCommentFromYouTube(youtube, commentDoc.youtubeId);
          if (delRes.success) {
            const youtubeAction = delRes.action || 'delete';
            const removedFromPublic = youtubeAction === 'delete' || youtubeAction === 'reject';
            status = removedFromPublic ? 'deleted' : 'flagged';
            deletedAt = removedFromPublic ? new Date() : null;
            deleteReason = `Auto-${youtubeAction} bad comment: ${matchedCategory}`;
            moderationStatus = removedFromPublic ? 'deleted' : 'heldForReview';
            executedAction = youtubeAction === 'reject' ? 'delete' : youtubeAction;
            wasHidden = youtubeAction === 'hide';
          } else {
            deleteFailed = true;
            deleteErrorReason = delRes.reason;
            status = 'flagged';
            moderationStatus = 'heldForReview';
            executedAction = 'hold';
            if (delRes.reconnectRequired) {
              await Channel.findByIdAndUpdate(channel._id, { reconnectRequired: true, reconnectReason: 'Missing manage comments permission (youtube.force-ssl)' });
            }
          }
        } else {
          // hold for review
          const hideRes = await hideComment(youtube, commentDoc.youtubeId);
          if (hideRes.success) {
            status = 'flagged';
            wasHidden = true;
            deleteReason = `Auto-held comment: ${matchedCategory}`;
            moderationStatus = 'heldForReview';
            executedAction = 'hold';
          } else {
            deleteFailed = true;
            deleteErrorReason = hideRes.reason;
            status = 'flagged';
            moderationStatus = 'heldForReview';
            executedAction = 'hold';
            if (hideRes.reconnectRequired) {
              await Channel.findByIdAndUpdate(channel._id, { reconnectRequired: true, reconnectReason: 'Missing manage comments permission (youtube.force-ssl)' });
            }
          }
        }
      }

      const loggedAction = executedAction === 'delete' ? 'deleted' : 'hidden';

      // Always save ModerationLog — both on success AND failure.
      // This ensures Comment History shows failed moderation attempts.
      try {
        const modLogData = {
          userId: channel.userId,
          organizationId: channel.organizationId,
          channelId: channel.channelId,
          videoId: commentDoc.videoId,
          commentId: commentDoc.youtubeId,
          authorName: commentDoc.author || 'Anonymous',
          commentText: commentDoc.text || '',
          category: matchedCategory !== 'safe' ? matchedCategory : 'toxic',
          confidence: aiResult.confidence || 0.85,
          toxicityScore: aiResult.toxicityScore || 0,
          reason: `Auto-detected: ${matchedCategory}`,
          action: loggedAction,
          executedAction: loggedAction,
          status: deleteFailed ? 'Failed' : 'Success',
          failureReason: deleteFailed ? (deleteErrorReason || 'YouTube API call failed') : null
        };
        // Upsert: one ModerationLog per commentId (first action wins)
        await ModerationLog.findOneAndUpdate(
          { commentId: commentDoc.youtubeId, userId: channel.userId },
          { $setOnInsert: modLogData },
          { upsert: true }
        );
        if (!deleteFailed) {
          await logAutomation(
            channel.userId,
            executedAction === 'delete' ? 'comment_delete' : 'comment_hide',
            `Auto-moderated comment (action: ${executedAction}) due to ${matchedCategory}`,
            { commentId: commentDoc.youtubeId, category: matchedCategory }
          );
        }
      } catch (modLogErr) {
        logger.error(`[Pipeline] Failed to save ModerationLog for ${commentDoc.youtubeId}: ${modLogErr.message}`);
      }

      // Save final classification updates and stop processing
      const newCommentData = {
        userId: channel.userId,
        organizationId: channel.organizationId,
        youtubeId: commentDoc.youtubeId,
        commentId: commentDoc.youtubeId, // alias
        channelId: channel.channelId,
        videoId: commentDoc.videoId,
        text: commentDoc.text,
        commentText: commentDoc.text, // alias
        author: commentDoc.author,
        username: commentDoc.author, // alias
        authorProfileImageUrl: commentDoc.authorProfileImageUrl,
        authorChannelId: commentDoc.authorChannelId || null,
        publishedAt: commentDoc.publishedAt,
        parentCommentId: commentDoc.parentCommentId || null,
        isReply: commentDoc.isReply || false,

        sentiment: aiResult.sentiment,
        toxicityScore: aiResult.toxicityScore,
        confidence: aiResult.confidence,
        language: aiResult.language,
        detectedWords: aiResult.detectedWords,
        status: status,
        autoLiked: false,
        deleteFailed,
        deleteError: deleteErrorReason,
        deleteReason,
        deletedAt,
        aiActionTaken: true,
        classification,
        moderationStatus,
        aiStatus: 'completed',
        actionTaken: executedAction,
        moderationReason: matchedCategory,
        textHash,
        isModerated: true,
        moderationAction: loggedAction
      };

      const updatedComment = await Comment.findOneAndUpdate(
        { userId: channel.userId, youtubeId: commentDoc.youtubeId },
        { $set: newCommentData },
        { upsert: true, returnDocument: 'after' }
      );

      if (io && updatedComment) {
        const roomName = channel.userId.toString();
        io.to(roomName).emit('live_activity', {
          ...updatedComment.toObject(),
          id: updatedComment._id,
          type: status === 'deleted' ? 'delete' : 'hold'
        });
        io.to(roomName).emit('new_comment_analyzed', updatedComment);
        io.to(roomName).emit('stats_updated');
        io.to(roomName).emit('moderationUpdate');
      }

      return true; // Stop processing
    }

    // 10. If safe: Match active reply rule
    let ruleMatchedAndExecuted = false;
    let replyText = null;
    let replyError = null;

    const rules = await AutoReplyRule.find({
      channelId: channel.channelId,
      userId: channel.userId,
      isActive: true
    });

    let matchedRule = null;
    let matchedKeyword = null;

    for (const rule of rules) {
      // Filter by videoIds if specified (empty array or 'all' contentType means channel-wide)
      const videoMatch = rule.contentType === 'all' || (rule.videoIds && rule.videoIds.includes(commentDoc.videoId));
      if (!videoMatch) continue;

      const textLower = commentDoc.text.toLowerCase().trim();
      let matched = false;

      if (rule.matchType === 'any_comment' || rule.triggerKeywords.includes('*')) {
        matched = true;
        matchedKeyword = '*';
      } else if (rule.matchType === 'contains_any') {
        matchedKeyword = rule.triggerKeywords.find(kw => textLower.includes(kw.toLowerCase().trim()));
        matched = !!matchedKeyword;
      } else if (rule.matchType === 'contains_all') {
        matched = rule.triggerKeywords.every(kw => textLower.includes(kw.toLowerCase().trim()));
        if (matched) matchedKeyword = rule.triggerKeywords.join(', ');
      } else if (rule.matchType === 'exact_match') {
        matchedKeyword = rule.triggerKeywords.find(kw => textLower === kw.toLowerCase().trim());
        matched = !!matchedKeyword;
      }

      if (matched) {
        matchedRule = rule;
        break;
      }
    }

    if (matchedRule) {
      // Generate context-aware human-like reply using DeepSeek
      const ruleBaseText = matchedRule.replyText || matchedRule.dmContent || 'Thank you for your comment!';
      replyText = await generateDeepseekHumanReply(commentDoc.text, ruleBaseText, userKey);

      if (matchedRule.replyType === 'Carousel' && matchedRule.carouselCards && matchedRule.carouselCards.length > 0) {
        const cardsFormatted = matchedRule.carouselCards.map(card => {
          return `Card:\nImage:\n${card.imageUrl || ''}\n\nTitle:\n${card.title || ''}\n\nDescription:\n${card.description || ''}\n\nButton:\n${card.btnLabel || card.buttonText || 'View Detail'}\n\nURL:\n${card.link || card.buttonUrl || ''}`;
        }).join('\n\n');
        replyText = cardsFormatted;
      }

      if (replyText && !channel.apiKey) {
        // Post reply on YouTube
        const repRes = await replyToComment(youtube, commentDoc.youtubeId, replyText);
        if (repRes.success) {
          replyStatus = 'sent';
          ruleMatchedAndExecuted = true;

          // Save AutoReplyLog — success
          try {
            const autoLog = new AutoReplyLog({
              commentId: commentDoc.youtubeId,
              userId: channel.userId,
              organizationId: channel.organizationId,
              channelId: channel.channelId,
              videoId: commentDoc.videoId,
              username: commentDoc.author || 'Anonymous',
              commentText: commentDoc.text,
              triggerKeyword: matchedKeyword || '*',
              replyType: matchedRule.replyType || 'Text',
              carouselCards: matchedRule.replyType === 'Carousel' ? matchedRule.carouselCards : [],
              replyText: replyText,
              aiReply: replyText,
              deepseekResponse: replyText,
              youtubeReplyId: repRes.newCommentId,
              status: 'success'
            });
            await autoLog.save();
          } catch (logErr) {
            if (logErr.code !== 11000) logger.error(`[Reply] Failed to save AutoReplyLog: ${logErr.message}`);
          }

          // Update Comment with reply details
          await Comment.findOneAndUpdate(
            { userId: channel.userId, youtubeId: commentDoc.youtubeId },
            {
              $set: {
                sentiment: aiResult.sentiment || 'positive',
                status: 'approved',
                hasReplied: true,
                repliedAt: new Date(),
                replyText,
                replyStatus: 'sent',
                youtubeReplyId: repRes.newCommentId,
                aiStatus: 'completed'
              }
            },
            { upsert: true }
          );

          // Save bot reply comment to skip moderation downstream
          if (repRes.newCommentId) {
            try {
              await Comment.findOneAndUpdate(
                { youtubeId: repRes.newCommentId, userId: channel.userId },
                {
                  $setOnInsert: {
                    userId: channel.userId,
                    organizationId: channel.organizationId,
                    youtubeId: repRes.newCommentId,
                    commentId: repRes.newCommentId,
                    channelId: channel.channelId,
                    videoId: commentDoc.videoId,
                    text: replyText,
                    commentText: replyText,
                    author: 'Bot (Comment Automation)',
                    username: 'Bot (Comment Automation)',
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
                { upsert: true, returnDocument: 'after' }
              );
            } catch (botSaveErr) {
              logger.error(`[Comment Automation] Failed to save bot reply: ${botSaveErr.message}`);
            }
          }

          // Broadcast Socket updates
          if (io) {
            const roomName = channel.userId.toString();
            io.to(roomName).emit('live_activity', {
              youtubeId: commentDoc.youtubeId,
              commentId: commentDoc.youtubeId,
              text: commentDoc.text,
              commentText: commentDoc.text,
              author: commentDoc.author,
              username: commentDoc.author,
              replyText,
              aiReply: replyText,
              type: 'new_comment',
              confidence: 1.0
            });
            io.to(roomName).emit('stats_updated');
            io.to(roomName).emit('replyUpdate');
          }
        } else {
          // Reply failed — save AutoReplyLog with status:failed so Comment History shows it
          replyStatus = 'failed';
          replyError = repRes.reason || 'YouTube reply API failed';
          try {
            const failLog = new AutoReplyLog({
              commentId: commentDoc.youtubeId,
              userId: channel.userId,
              organizationId: channel.organizationId,
              channelId: channel.channelId,
              videoId: commentDoc.videoId,
              username: commentDoc.author || 'Anonymous',
              commentText: commentDoc.text,
              triggerKeyword: matchedKeyword || '*',
              replyText: replyText,
              aiReply: replyText,
              status: 'failed',
              failureReason: replyError
            });
            await failLog.save();
          } catch (logErr) {
            if (logErr.code !== 11000) logger.error(`[Reply] Failed to save failed AutoReplyLog: ${logErr.message}`);
          }
        }
      }
    } else if (tenantSettings.smartAiReply && aiResult.suggestedReply && !channel.apiKey) {
      replyText = aiResult.suggestedReply;

      // Post reply on YouTube
      const repRes = await replyToComment(youtube, commentDoc.youtubeId, replyText);
      if (repRes.success) {
        replyStatus = 'sent';
        ruleMatchedAndExecuted = true;

        // Save AutoReplyLog — success
        try {
          const autoLog = new AutoReplyLog({
            commentId: commentDoc.youtubeId,
            userId: channel.userId,
            organizationId: channel.organizationId,
            channelId: channel.channelId,
            videoId: commentDoc.videoId,
            username: commentDoc.author || 'Anonymous',
            commentText: commentDoc.text,
            triggerKeyword: 'AI Smart Reply',
            replyText: replyText,
            aiReply: replyText,
            deepseekResponse: replyText,
            youtubeReplyId: repRes.newCommentId,
            status: 'success'
          });
          await autoLog.save();
        } catch (logErr) {
          if (logErr.code !== 11000) logger.error(`[SmartReply] Failed to save AutoReplyLog: ${logErr.message}`);
        }

        // Update Comment with reply details
        await Comment.findOneAndUpdate(
          { userId: channel.userId, youtubeId: commentDoc.youtubeId },
          {
            $set: {
              sentiment: aiResult.sentiment || 'positive',
              status: 'approved',
              hasReplied: true,
              repliedAt: new Date(),
              replyText,
              replyStatus: 'sent',
              youtubeReplyId: repRes.newCommentId,
              aiStatus: 'completed'
            }
          },
          { upsert: true }
        );

        // Save bot reply comment to skip moderation downstream
        if (repRes.newCommentId) {
          try {
            await Comment.findOneAndUpdate(
              { youtubeId: repRes.newCommentId, userId: channel.userId },
              {
                $setOnInsert: {
                  userId: channel.userId,
                  organizationId: channel.organizationId,
                  youtubeId: repRes.newCommentId,
                  commentId: repRes.newCommentId,
                  channelId: channel.channelId,
                  videoId: commentDoc.videoId,
                  text: replyText,
                  commentText: replyText,
                  author: 'Bot (Comment Automation)',
                  username: 'Bot (Comment Automation)',
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
              { upsert: true, returnDocument: 'after' }
            );
          } catch (botSaveErr) {
            logger.error(`[Comment Automation] Failed to save bot reply: ${botSaveErr.message}`);
          }
        }

        // Broadcast Socket updates
        if (io) {
          const roomName = channel.userId.toString();
          io.to(roomName).emit('live_activity', {
            youtubeId: commentDoc.youtubeId,
            commentId: commentDoc.youtubeId,
            text: commentDoc.text,
            commentText: commentDoc.text,
            author: commentDoc.author,
            username: commentDoc.author,
            replyText,
            aiReply: replyText,
            type: 'new_comment',
            confidence: 1.0
          });
          io.to(roomName).emit('stats_updated');
          io.to(roomName).emit('replyUpdate');
        }
      } else {
        // SmartReply failed — save AutoReplyLog with status:failed so Comment History shows it
        replyStatus = 'failed';
        replyError = repRes.reason || 'YouTube reply API failed';
        try {
          const failLog = new AutoReplyLog({
            commentId: commentDoc.youtubeId,
            userId: channel.userId,
            organizationId: channel.organizationId,
            channelId: channel.channelId,
            videoId: commentDoc.videoId,
            username: commentDoc.author || 'Anonymous',
            commentText: commentDoc.text,
            triggerKeyword: 'AI Smart Reply',
            replyText: replyText,
            aiReply: replyText,
            status: 'failed',
            failureReason: replyError
          });
          await failLog.save();
        } catch (logErr) {
          if (logErr.code !== 11000) logger.error(`[SmartReply] Failed to save failed AutoReplyLog: ${logErr.message}`);
        }
      }
    }

    // Auto Like positive comments (if safe and positive)
    let autoLiked = false;
    let likeStatus = 'none';
    let likeError = null;

    const isPositive = (aiResult.sentiment === 'positive' || rawAnalysis.positive) && isConfident;
    const isMeaningful = commentDoc.text && commentDoc.text.trim().length > 3;

    if (status !== 'deleted' && status !== 'flagged' && isPositive && isMeaningful && tenantSettings.autoLike) {
      if (channel.apiKey) {
        likeStatus = 'not_supported';
        likeError = 'Authentication via API Key does not permit write actions (OAuth required)';
      } else {
        const result = await likeComment(youtube, commentDoc.youtubeId);
        likeStatus = result.status;
        likeError = result.reason;
        autoLiked = result.success;
      }

      try {
        await AutoLikeLog.findOneAndUpdate(
          { commentId: commentDoc.youtubeId },
          {
            $setOnInsert: {
              userId: channel.userId,
              organizationId: channel.organizationId,
              channelId: channel.channelId,
              videoId: commentDoc.videoId,
              commentId: commentDoc.youtubeId,
              processedAt: new Date(),
              autoLiked: true,
              status: likeStatus
            }
          },
          { upsert: true, returnDocument: 'after' }
        );
      } catch (logErr) {
        logger.error(`[AUTO-LIKE] Failed to save AutoLikeLog: ${logErr.message}`);
      }
    }

    // 14. Lead Capture Workflow
    // Capture a lead whenever a SAFE comment (not toxic) contains ANY lead keyword.
    // WhatsApp DM is sent only if a phone number is also detected.
    const whatsappNumber = detectWhatsAppNumber(commentDoc.text);
    const defaultLeadKeywords = [
      'price', 'rate', 'cost', 'amount', 'details', 'detail', 'course', 'join', 'contact', 'phone', 'call', 'whatsapp', 'demo', 'fees',
      'buy', 'order', 'purchase', 'interested', 'dm', 'message', 'number', 'available', 'booking', 'enroll', 'apply',
      'vilai', 'evlo', 'evalo', 'eppadi join', 'contact pannunga', 'whatsapp pannunga'
    ];
    const leadKeywords = Array.isArray(tenantSettings.leadKeywords) && tenantSettings.leadKeywords.length > 0
      ? [...new Set([...tenantSettings.leadKeywords, ...defaultLeadKeywords])]
      : defaultLeadKeywords;
    const matchesLeadKeywords = checkLeadKeywordsMatched(commentDoc.text, leadKeywords);
    const aiLeadDetected = aiResult?.lead?.isLead === true || rawAnalysis?.buyingIntent === true || rawAnalysis?.customer === true;
    const hasLeadSignal = matchesLeadKeywords || Boolean(whatsappNumber) || aiLeadDetected;

    // Capture lead for safe comments whenever a lead signal exists. Auto-reply success is not required.
    if (!moderationActionTaken && status !== 'deleted' && hasLeadSignal) {
      leadStatus = 'processing';
      const idempotencyKey = `${channel.organizationId || channel.userId}_${channel.channelId}_${commentDoc.youtubeId}_lead`;

      const leadExists = await Lead.exists({ idempotencyKey });
      if (!leadExists) {
        try {
          const phoneToUse = whatsappNumber || rawAnalysis?.whatsappNumber || rawAnalysis?.phoneNumber || aiResult?.lead?.phone;
          const emailToUse = rawAnalysis?.email || aiResult?.lead?.email;
          const intentToUse = aiResult?.lead?.intent || (rawAnalysis?.buyingIntent ? 'Purchase Intent' : (rawAnalysis?.customer ? 'Interested' : (matchesLeadKeywords ? 'Keyword Match' : 'Contact Request')));
          const matchedLeadKeywords = leadKeywords.filter(k => commentDoc.text.toLowerCase().includes(String(k).toLowerCase()));
          const notesText = `Product: ${rawAnalysis?.productInterest || 'General'} | Language: ${aiResult?.language || rawAnalysis?.detectedLanguage || 'Unknown'} | Keywords: ${matchedLeadKeywords.join(', ') || 'AI/phone signal'}`;

          logger.info(`[LEADS] Creating lead for comment ${commentDoc.youtubeId} (keyword match)`);
          const { lead, isDuplicate } = await createLead({
            userId: channel.userId,
            organizationId: channel.organizationId,
            idempotencyKey,
            channelId: channel.channelId,
            videoId: commentDoc.videoId,
            commentId: commentDoc.youtubeId,
            authorName: commentDoc.author,
            originalComment: commentDoc.text,
            whatsappNumber: phoneToUse || 'None',
            email: emailToUse || null,
            intent: intentToUse,
            productInterest: aiResult?.lead?.productInterest || rawAnalysis?.productInterest || 'General',
            language: aiResult?.language || rawAnalysis?.detectedLanguage || 'Unknown',
            notes: notesText,
          });
          leadStatus = isDuplicate ? 'duplicate' : 'pending';

          // Only send WhatsApp DM if phone number detected AND GoWhats configured
          if (!isDuplicate && phoneToUse && phoneToUse !== 'None' && user.gowhatsApiKey) {
            // Hide the comment to protect phone number privacy when OAuth write access is available.
            if (!channel.apiKey && youtube) {
              const hideRes = await hideComment(youtube, commentDoc.youtubeId);
              if (hideRes.success) {
                lead.isHidden = true;
                status = 'flagged';
                wasHidden = true;
              }
            }
            const productLink = user.productLink || process.env.PRODUCT_LINK || 'https://ChannelMate.com';
            const messageTemplate = `Hi ${commentDoc.author},\n\nThank you for showing interest! 🚀\n\nHere is the link for more details: ${productLink}\n\nOur team will reach out to you shortly. Feel free to reply if you have any questions!`;
            const decryptedGoWhatsKey = user.gowhatsApiKey ? decrypt(user.gowhatsApiKey) : null;
            logger.info(`[LEADS] Sending WhatsApp alert to ${phoneToUse}`);
            const waRes = await sendWhatsAppMessage(phoneToUse, messageTemplate, 3, decryptedGoWhatsKey, user.gowhatsUrl);

            const waLog = new GoWhatsLog({
              userId: channel.userId,
              leadId: lead._id,
              channelId: channel.channelId,
              videoId: commentDoc.videoId,
              recipientNumber: phoneToUse,
              message: messageTemplate,
              status: waRes.success ? 'sent' : 'failed',
              error: waRes.success ? null : waRes.error
            });
            await waLog.save();

            lead.status = waRes.success ? 'sent' : 'failed';
            lead.whatsappSent = waRes.success;
            lead.errorLog = waRes.success ? null : waRes.error;
            leadStatus = waRes.success ? 'sent' : 'failed';
            await lead.save();
          }

          if (io) {
            io.to(channel.userId.toString()).emit('lead_created', lead);
            io.to(channel.userId.toString()).emit('stats_updated');
          }
        } catch (leadErr) {
          if (leadErr.code === 11000) {
            logger.info(`[LEADS] Duplicate lead blocked for ${commentDoc.youtubeId}`);
          } else {
            logger.error(`[LEADS] Failed to create lead: ${leadErr.message}`);
          }
        }
      } else {
        logger.info(`[LEADS] Duplicate lead workflow blocked for comment ${commentDoc.youtubeId}`);
      }
    }

    // Save final updates only if a successful action (like, reply, moderation, or lead capture) was performed
    // Always save final Comment state — every analyzed comment must be persisted.
    // Previously this was gated by action success, which left safe/unmatched comments invisible.
    if (true) { // unconditional: MongoDB is source of truth for all analyzed comments
      const newCommentData = {
        userId: channel.userId,
        organizationId: channel.organizationId,
        youtubeId: commentDoc.youtubeId,
        commentId: commentDoc.youtubeId, // alias
        channelId: channel.channelId,
        videoId: commentDoc.videoId,
        text: commentDoc.text,
        commentText: commentDoc.text, // alias
        author: commentDoc.author,
        username: commentDoc.author, // alias
        authorProfileImageUrl: commentDoc.authorProfileImageUrl,
        authorChannelId: commentDoc.authorChannelId || null,
        publishedAt: commentDoc.publishedAt,
        parentCommentId: commentDoc.parentCommentId || null,
        isReply: commentDoc.isReply || false,

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
        aiActionTaken: true,
        classification,
        suggestedReply: replyText || aiResult.suggestedReply,
        replyText,
        replyStatus,
        replyError,
        note: wasHidden ? 'Auto-hidden for privacy/compliance' : '',
        moderationStatus: wasHidden ? 'heldForReview' : moderationStatus,
        aiStatus: 'completed',
        actionTaken: executedAction,
        moderationReason: matchedCategory !== 'safe' ? matchedCategory : undefined,
        hasReplied: replyStatus === 'sent',
        repliedAt: replyStatus === 'sent' ? new Date() : null,
        textHash
      };

      const updatedComment = await Comment.findOneAndUpdate(
        { userId: channel.userId, youtubeId: commentDoc.youtubeId },
        { $set: newCommentData },
        { upsert: true, returnDocument: 'after' }
      );

      // Broadcast update using Socket.IO for Live Dashboard
      if (io && updatedComment) {
        const roomName = channel.userId.toString();
        io.to(roomName).emit('live_activity', {
          ...updatedComment.toObject(),
          id: updatedComment._id,
          type: status === 'deleted' ? 'delete' : (autoLiked ? 'like' : 'new_comment')
        });
        io.to(roomName).emit('new_comment_analyzed', updatedComment);
        io.to(roomName).emit('stats_updated');
      }
    }

    return true;
  } catch (error) {
    logger.error(`Error processing single comment ${commentDoc.youtubeId}:`, error);
    return false;
  } finally {
    activeCommentsProcessing.delete(commentDoc.youtubeId);
  }
};

/**
 * Main worker pipeline. Triggered by scheduled cron job or auth callback.
 */
export const processComments = async (channel, tokens = null, apiKey = null, io = null, videoId = null) => {
  let newestSyncDate = null;
  let latestChannel = null;
  try {
    if (channel.channelId && channel.channelId.startsWith('PENDING_')) {
      logger.info(`[SYNC] Skipping pending channel: ${channel.channelId} (No YouTube API calls will be made)`);
      return;
    }

    latestChannel = await Channel.findById(channel._id);
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

    // Cooldown check (30 seconds / 30,000 ms) - bypassed if videoId is provided (manual sync)
    if (!videoId && latestChannel.lastSyncedAt) {
      const timeSinceLastSync = Date.now() - latestChannel.lastSyncedAt.getTime();
      if (timeSinceLastSync < 30000) {
        logger.info(`[SYNC] Skipping channel ${latestChannel.title || latestChannel.channelId} - synced recently (${Math.round(timeSinceLastSync / 1000)}s ago).`);
        return;
      }
    }

    // Acquire a temporary sync lock immediately by updating lastSyncedAt to current time
    if (!videoId) {
      await Channel.updateOne({ _id: latestChannel._id }, { $set: { lastSyncedAt: new Date() } });
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

    if (latestChannel.lastSyncedAt && latestChannel.lastSyncedAt.getTime() === 0) {
      logger.info(`Initial Full Sync currently in progress for channel: ${channel.title}. Sync call skipped.`);
      return;
    }

    if (!latestChannel.lastSyncedAt) {
      await Channel.findByIdAndUpdate(channel._id, { lastSyncedAt: new Date(0) });
      logger.info(`[INITIAL SYNC] Starting Initial Full Sync for channel: ${channel.title} (ID: ${channel.channelId})`);

      try {
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

        logger.info(`[INITIAL SYNC] Skipped importing historical comments to avoid storing old comments.`);
        newestSyncDate = new Date();
        logger.info(`[INITIAL SYNC] Initial Full Sync Completed for Channel: ${channel.title}`);
      } catch (syncErr) {
        logger.error(`[INITIAL SYNC] Failed sync for channel ${channel.title}:`, syncErr);
        await Channel.findByIdAndUpdate(channel._id, { lastSyncedAt: null });
        if (isQuotaError(syncErr)) throw syncErr;
        return;
      }
    } else {
      if (!videoId) {
        try {
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

      newestSyncDate = latestChannel.lastSyncedAt ? new Date(latestChannel.lastSyncedAt) : new Date(Date.now() - 300000);
      try {
        const comments = await fetchLatestComments(youtube, channel.channelId, 50, videoId);
        if (comments && comments.length > 0) {
          logger.info(`[SYNC] Fetched ${comments.length} comments from YouTube. Processing list...`);

          const sortedComments = [...comments].sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));

          for (const c of sortedComments) {
            const success = await processSingleComment(youtube, latestChannel, userKey, userSettings, c, io);
            if (success) {
              const commentDate = new Date(c.publishedAt);
              if (commentDate > newestSyncDate) {
                newestSyncDate = commentDate;
              }
            }
          }
        }
      } catch (err) {
        logger.error('Error syncing latest comments:', err);
        if (isQuotaError(err)) throw err;
      }
    }

    if (io) {
      io.to(channel.userId.toString()).emit('stats_updated');
    }

    await Channel.updateOne({ _id: channel._id }, { $set: { lastSyncedAt: newestSyncDate } });
    clearQuotaBackoff(channel._id.toString());
  } catch (error) {
    if (latestChannel && !isQuotaError(error)) {
      await Channel.updateOne({ _id: channel._id }, { $set: { lastSyncedAt: latestChannel.lastSyncedAt } });
    }
    if (isQuotaError(error)) {
      handleQuotaError(channel._id.toString());
    } else {
      logger.error('Worker error:', error);
    }
  }
};
