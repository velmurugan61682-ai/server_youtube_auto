import mongoose from 'mongoose';
import Comment from '../models/Comment.mjs';
import Lead from '../models/Lead.mjs';
import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';
import AutoLikeLog from '../models/AutoLikeLog.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import { getYouTubeClient } from '../services/youtubeService.mjs';
import { decrypt, encrypt } from '../utils/cryptoHelper.mjs';
import logger from '../utils/logger.mjs';

export const getAnalytics = async (req, res) => {
  try {
    const { channelId, startDate, endDate } = req.query;
    
    // Resolve organization channels
    const filter = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }] }
      : { userId: req.user.id };
    const channels = await Channel.find(filter).select('channelId').lean();
    const channelIds = channels.map(c => c.channelId);

    // Resolve organization users
    const filterUser = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { _id: req.user.id }] }
      : { _id: req.user.id };
    const users = await User.find(filterUser).select('_id').lean();
    const userIds = users.map(u => u._id);

    // Parse date filters
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // default to last 30 days
    const start = startDate ? new Date(startDate) : defaultStart;
    const end = endDate ? new Date(endDate) : now;

    const channelFilter = channelId && channelIds.includes(channelId) ? channelId : { $in: channelIds };

    // 1. Engagement Card: Total comments in the date range
    const totalComments = await Comment.countDocuments({
      userId: { $in: userIds },
      channelId: channelFilter,
      publishedAt: { $gte: start, $lte: end }
    });

    // 2. Positive Card: Sentiment is positive
    const totalPositive = await Comment.countDocuments({
      userId: { $in: userIds },
      channelId: channelFilter,
      sentiment: 'positive',
      publishedAt: { $gte: start, $lte: end }
    });

    // 3. Toxic Card: Comments classified as toxic by DeepSeek (from Comment collection)
    const totalToxic = await Comment.countDocuments({
      userId: { $in: userIds },
      channelId: channelFilter,
      sentiment: 'toxic',
      publishedAt: { $gte: start, $lte: end }
    });

    // 4. Moderate Card: Comments needing review (held, flagged, or moderate status)
    const totalModerate = await Comment.countDocuments({
      userId: { $in: userIds },
      channelId: channelFilter,
      $or: [
        { status: 'moderate' },
        { status: 'flagged', deleteFailed: true }
      ],
      publishedAt: { $gte: start, $lte: end }
    });

    // Sentiment 'neutral' count for charts
    const totalNeutral = await Comment.countDocuments({
      userId: { $in: userIds },
      channelId: channelFilter,
      sentiment: 'neutral',
      publishedAt: { $gte: start, $lte: end }
    });

    // 5. Auto Shield Card: Total automatic deletes/holds from ModerationLog
    const toxicDeleted = await ModerationLog.countDocuments({
      userId: { $in: userIds },
      channelId: channelFilter,
      status: { $in: ['Success', 'success'] },
      $or: [
        { executedAction: { $in: ['delete', 'hold', 'deleted', 'hidden'] } },
        { action: { $in: ['delete', 'hold', 'deleted', 'hidden'] } }
      ],
      createdAt: { $gte: start, $lte: end }
    });

    // 6. Auto Likes Card: Total successful auto likes
    const positiveLiked = await AutoLikeLog.countDocuments({
      userId: { $in: userIds },
      channelId: channelFilter,
      autoLiked: true,
      createdAt: { $gte: start, $lte: end }
    });

    // 7. Auto Reply Card (Auto DM): Total successful replies from AutoReplyLog
    const totalAutoDms = await AutoReplyLog.countDocuments({
      userId: { $in: userIds },
      channelId: channelFilter,
      status: { $in: ['success', 'Success'] },
      createdAt: { $gte: start, $lte: end }
    });

    // Calculate percentage change for Auto Replies (last 30 days comparison)
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const previousStart = new Date(start.getTime() - thirtyDays);
    const previousEnd = start;

    const previousAutoReplies = await AutoReplyLog.countDocuments({
      userId: { $in: userIds },
      channelId: channelFilter,
      status: 'success',
      createdAt: { $gte: previousStart, $lt: previousEnd }
    });

    let changePercentage = 0;
    if (previousAutoReplies > 0) {
      changePercentage = Math.round(((totalAutoDms - previousAutoReplies) / previousAutoReplies) * 100);
    } else if (totalAutoDms > 0) {
      changePercentage = 100;
    }

    // ──────────────────────────────────────────────────────────
    // YOUTUBE CHANNEL SUMMARY CARD DATA
    // ──────────────────────────────────────────────────────────
    let channelSummary = null;

    // Find the currently active connected channel
    const activeChannel = channelId 
      ? await Channel.findOne({ userId: req.user.id, channelId })
      : await Channel.findOne({ userId: req.user.id });

    if (activeChannel && !activeChannel.apiKey) {
      try {
        const decryptedTokens = {
          access_token: decrypt(activeChannel.accessToken),
          refresh_token: activeChannel.refreshToken ? decrypt(activeChannel.refreshToken) : undefined,
          expiry_date: activeChannel.expiryDate
        };

        const youtube = getYouTubeClient(decryptedTokens, async (newTokens) => {
          logger.info(`[Analytics] Tokens refreshed for channel ${activeChannel.channelId}`);
          await Channel.findOneAndUpdate(
            { userId: activeChannel.userId, channelId: activeChannel.channelId },
            {
              $set: {
                accessToken: encrypt(newTokens.access_token),
                refreshToken: encrypt(newTokens.refresh_token || decrypt(activeChannel.refreshToken)),
                expiryDate: newTokens.expiry_date
              }
            }
          );
        }, activeChannel._id);

        // Fetch channel info
        const channelRes = await youtube.channels.list({ part: 'snippet,statistics', mine: true });
        const channelItem = channelRes.data?.items?.[0];

        if (channelItem) {
          // Fetch subscriptions
          let subscriptionCount = 0;
          let nextPageToken = null;
          let permissionError = false;

          try {
            do {
              const subRes = await youtube.subscriptions.list({
                part: 'id',
                mine: true,
                maxResults: 50,
                ...(nextPageToken && { pageToken: nextPageToken })
              });
              const items = subRes.data?.items || [];
              subscriptionCount += items.length;
              nextPageToken = subRes.data?.nextPageToken;
            } while (nextPageToken);
          } catch (subErr) {
            logger.error(`Failed to fetch subscriptions: ${subErr.message}`);
            permissionError = true;
          }

          channelSummary = {
            title: channelItem.snippet.title,
            thumbnailUrl: channelItem.snippet.thumbnails?.high?.url || channelItem.snippet.thumbnails?.default?.url,
            videoCount: channelItem.statistics?.videoCount || '0',
            subscriberCount: channelItem.statistics?.subscriberCount || '0',
            subscriptionCount: permissionError ? '—' : subscriptionCount.toString()
          };

          // Update existing channel statistics in DB to keep it updated (NO duplicates inserted)
          await Channel.updateOne(
            { userId: activeChannel.userId, channelId: activeChannel.channelId },
            {
              $set: {
                title: channelItem.snippet.title,
                thumbnailUrl: channelItem.snippet.thumbnails?.default?.url || '',
                'statistics.subscriberCount': channelItem.statistics?.subscriberCount || '0',
                'statistics.videoCount': channelItem.statistics?.videoCount || '0',
                'statistics.viewCount': channelItem.statistics?.viewCount || '0'
              }
            }
          );
        }
      } catch (ytErr) {
        logger.error(`Failed to fetch real YouTube statistics in analytics endpoint: ${ytErr.message}`);
        // Fallback to DB stored data if API fails (e.g. quota, network)
        channelSummary = {
          title: activeChannel.title,
          thumbnailUrl: activeChannel.thumbnailUrl,
          videoCount: activeChannel.statistics?.videoCount || '0',
          subscriberCount: activeChannel.statistics?.subscriberCount || '0',
          subscriptionCount: '—'
        };
      }
    } else if (activeChannel && activeChannel.apiKey) {
      // API Key channel doesn't support Google OAuth calls, so use stored info
      channelSummary = {
        title: activeChannel.title,
        thumbnailUrl: activeChannel.thumbnailUrl,
        videoCount: activeChannel.statistics?.videoCount || '0',
        subscriberCount: activeChannel.statistics?.subscriberCount || '0',
        subscriptionCount: '—'
      };
    }

    // 8. Total Leads: Count from Lead collection (real MongoDB data)
    const totalLeadsCount = await Lead.countDocuments({
      userId: { $in: userIds },
      channelId: channelFilter,
      createdAt: { $gte: start, $lte: end }
    });

    // 9. Language Breakdown: Group comments by detected language
    const languageBreakdown = await Comment.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          channelId: typeof channelFilter === 'string' ? channelFilter : { $in: channelIds },
          publishedAt: { $gte: start, $lte: end },
          isBotReply: { $ne: true }
        }
      },
      {
        $addFields: {
          // Normalize language: treat null/unknown/empty as 'English'
          normalizedLang: {
            $cond: [
              { $or: [
                { $eq: ['$language', null] },
                { $eq: ['$language', ''] },
                { $eq: ['$language', 'unknown'] }
              ]},
              'English',
              '$language'
            ]
          }
        }
      },
      { $group: { _id: '$normalizedLang', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);

    // 10. Top Word Categories: Group by comment classification/category from DeepSeek
    const topWordCategories = await Comment.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          channelId: typeof channelFilter === 'string' ? channelFilter : { $in: channelIds },
          publishedAt: { $gte: start, $lte: end },
          classification: { $exists: true, $nin: [null, '', 'none', 'unknown', 'bot_reply'] }
        }
      },
      { $group: { _id: '$classification', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 }
    ]);

    // Build categories array for StatsGrid (Positive, Toxic, Neutral, Moderate cards)
    const categories = [
      { _id: 'positive',  count: totalPositive },
      { _id: 'toxic',     count: totalToxic },
      { _id: 'neutral',   count: totalNeutral },
      { _id: 'moderate',  count: totalModerate }
    ];

    res.json({
      totalComments,
      toxicDeleted,
      positiveLiked,
      pendingModeration: totalModerate,
      totalLeads: totalLeadsCount,
      // Sentiment categories for StatsGrid Positive/Toxic/Neutral cards
      categories,
      // Individual counts for backward compatibility
      totalPositive,
      totalToxic,
      totalNeutral,
      // Language Breakdown for dashboard chart
      languages: languageBreakdown,
      // Top Word Categories for dashboard
      topCategories: topWordCategories,
      autoDm: {
        total: totalAutoDms,
        changePercentage
      },
      channelSummary,
      aiStatus: global.isAiAvailable !== false ? 'Available' : 'Unavailable'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/analytics/dashboard
 * Return summary statistics for YouTube Creator SaaS dashboard
 */
export const getDashboardAnalytics = async (req, res) => {
  try {
    const filter = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }] }
      : { userId: req.user.id };

    const channels = await Channel.find(filter).lean();
    const channelIds = channels.map(c => c.channelId);

    const subscribers = channels.reduce((acc, c) => acc + parseInt(c.statistics?.subscriberCount || 0), 0);
    const videos = channels.reduce((acc, c) => acc + parseInt(c.statistics?.videoCount || 0), 0);
    const comments = await Comment.countDocuments({ channelId: { $in: channelIds } });
    const replies = await Comment.countDocuments({ channelId: { $in: channelIds }, autoReplied: true });
    const automationCount = await AutoReplyLog.countDocuments({ channelId: { $in: channelIds } });
    const moderationCount = await ModerationLog.countDocuments({ channelId: { $in: channelIds } });

    return res.json({
      success: true,
      data: {
        subscribers,
        videos,
        comments,
        replies,
        automationCount,
        moderationCount
      }
    });
  } catch (error) {
    logger.error('Error in getDashboardAnalytics:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch dashboard analytics' });
  }
};

