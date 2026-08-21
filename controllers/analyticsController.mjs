import mongoose from 'mongoose';
import Comment from '../models/Comment.mjs';
import Lead from '../models/Lead.mjs';
import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';
import Video from '../models/Video.mjs';
import AutoLikeLog from '../models/AutoLikeLog.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import { getYouTubeClient } from '../services/youtubeService.mjs';
import { decrypt, encrypt } from '../utils/cryptoHelper.mjs';
import logger from '../utils/logger.mjs';

export const getAnalytics = async (req, res) => {
  try {
    const { channelId, startDate, endDate } = req.query;

    // Organization-Aware Data Isolation - Resolve users and channels concurrently
    const filterUser = req.user.organizationId
      ? { $or: [{ organizationId: req.user.organizationId }, { _id: req.user.id }] }
      : { _id: req.user.id };
    const filterChannel = req.user.organizationId
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }] }
      : { userId: req.user.id };

    const [orgUsers, channels] = await Promise.all([
      User.find(filterUser).select('_id').lean(),
      Channel.find(filterChannel).select('channelId').lean()
    ]);

    const userIds = orgUsers.map(u => u._id.toString());
    const channelIds = channels.map(c => c.channelId);

    const userObjectIds = userIds.map(id => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch (e) {
        return id;
      }
    });
    const userMatchFilter = { $in: [...userIds, ...userObjectIds] };

    // Parse date filters
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // default to last 30 days
    const start = startDate ? new Date(startDate) : defaultStart;
    const end = endDate ? new Date(endDate) : now;

    const channelFilter = channelId && channelIds.includes(channelId) ? channelId : { $in: channelIds };
    const commentDateWindow = startDate ? {
      $or: [
        { publishedAt: { $gte: start, $lte: end } },
        { createdAt: { $gte: start, $lte: end } }
      ]
    } : {
      $or: [
        { publishedAt: { $lte: end } },
        { createdAt: { $lte: end } },
        { publishedAt: { $exists: true } }
      ]
    };
    const commentBaseQuery = (...conditions) => ({
      userId: userMatchFilter,
      channelId: channelFilter,
      isBotReply: { $ne: true },
      $and: [commentDateWindow, ...conditions]
    });
    const toxicClassificationValues = ['toxic', 'Toxic', 'TOXIC', 'spam', 'Spam', 'SPAM', 'hate speech', 'Hate Speech', 'abuse', 'Abuse', 'threat', 'scam', 'sexual content'];

    // Calculate dates for percentage comparison
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const previousStart = new Date(start.getTime() - thirtyDays);
    const previousEnd = start;

    // Execute ALL analytics count queries concurrently in parallel using indexed exact matches
    const [
      commentDocCount,
      modLogCount,
      totalPositive,
      commentToxicCount,
      modToxicCount,
      commentModCount,
      modReviewCount,
      totalNeutral,
      toxicDeleted,
      positiveLiked,
      totalAutoDms,
      previousAutoReplies
    ] = await Promise.all([
      Comment.countDocuments(commentBaseQuery()),
      ModerationLog.countDocuments({
        userId: { $in: userIds },
        channelId: channelFilter,
        createdAt: { $gte: start, $lte: end }
      }),
      Comment.countDocuments(commentBaseQuery({
        $or: [
          { sentiment: { $in: ['positive', 'Positive', 'POSITIVE'] } },
          { classification: { $in: ['positive', 'Positive', 'POSITIVE'] } }
        ]
      })),
      Comment.countDocuments(commentBaseQuery({
        $or: [
          { sentiment: { $in: ['toxic', 'Toxic', 'TOXIC'] } },
          { classification: { $in: toxicClassificationValues } },
          { moderationStatus: { $in: ['deleted', 'heldForReview'] } },
          { status: 'deleted' }
        ]
      })),
      ModerationLog.countDocuments({
        userId: { $in: userIds },
        channelId: channelFilter,
        $or: [
          { action: { $in: ['delete', 'deleted', 'hold', 'hidden'] } },
          { executedAction: { $in: ['delete', 'deleted', 'hold', 'hidden'] } },
          { category: { $in: ['toxic', 'Toxic', 'spam', 'Spam', 'abuse', 'Abuse', 'hate', 'Hate'] } }
        ],
        createdAt: { $gte: start, $lte: end }
      }),
      Comment.countDocuments(commentBaseQuery({
        $or: [
          { sentiment: { $in: ['moderate', 'Moderate', 'MODERATE'] } },
          { status: { $in: ['moderate', 'flagged'] } },
          { moderationStatus: { $in: ['needsReview', 'heldForReview'] } }
        ]
      })),
      ModerationLog.countDocuments({
        userId: { $in: userIds },
        channelId: channelFilter,
        $or: [
          { action: { $in: ['hold', 'review', 'needsReview', 'flagged'] } },
          { executedAction: { $in: ['hold', 'review', 'needsReview', 'flagged'] } },
          { status: { $in: ['needsReview', 'heldForReview', 'flagged'] } }
        ],
        createdAt: { $gte: start, $lte: end }
      }),
      Comment.countDocuments(commentBaseQuery({
        $or: [
          { sentiment: { $in: ['neutral', 'Neutral', 'NEUTRAL'] } },
          { classification: { $in: ['neutral', 'Neutral', 'NEUTRAL'] } }
        ]
      })),
      ModerationLog.countDocuments({
        userId: { $in: userIds },
        channelId: channelFilter,
        status: { $in: ['Success', 'success'] },
        $or: [
          { executedAction: { $in: ['delete', 'hold', 'deleted', 'hidden'] } },
          { action: { $in: ['delete', 'hold', 'deleted', 'hidden'] } }
        ],
        createdAt: { $gte: start, $lte: end }
      }),
      AutoLikeLog.countDocuments({
        userId: { $in: userIds },
        channelId: channelFilter,
        autoLiked: true,
        createdAt: { $gte: start, $lte: end }
      }),
      AutoReplyLog.countDocuments({
        userId: { $in: userIds },
        channelId: channelFilter,
        status: { $in: ['success', 'Success'] },
        createdAt: { $gte: start, $lte: end }
      }),
      AutoReplyLog.countDocuments({
        userId: { $in: userIds },
        channelId: channelFilter,
        status: 'success',
        createdAt: { $gte: previousStart, $lt: previousEnd }
      })
    ]);

    const totalComments = commentDocCount + modLogCount;
    const totalToxic = Math.max(commentToxicCount, modToxicCount);
    const totalModerate = Math.max(commentModCount, modReviewCount);

    let changePercentage = 0;
    if (previousAutoReplies > 0) {
      changePercentage = Math.round(((totalAutoDms - previousAutoReplies) / previousAutoReplies) * 100);
    } else if (totalAutoDms > 0) {
      changePercentage = 100;
    }

    // ──────────────────────────────────────────────────────────
    // YOUTUBE CHANNEL SUMMARY CARD DATA (Instant DB response)
    // ──────────────────────────────────────────────────────────
    let channelSummary = null;
    let liveViewers = 0;

    // Find the currently active connected channel
    const activeChannelFilter = req.user.organizationId
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }] }
      : { userId: req.user.id };
    if (channelId) activeChannelFilter.channelId = channelId;
    const activeChannel = await Channel.findOne(activeChannelFilter).lean();

    if (activeChannel) {
      channelSummary = {
        title: activeChannel.title || 'YouTube Channel',
        thumbnailUrl: activeChannel.thumbnailUrl || '',
        videoCount: activeChannel.statistics?.videoCount || '0',
        subscriberCount: activeChannel.statistics?.subscriberCount || '0',
        subscriptionCount: '—'
      };

      // Non-blocking background YouTube refresh (executes after res.json to avoid blocking HTTP response)
      if (!activeChannel.apiKey && !activeChannel.reconnectRequired && activeChannel.accessToken) {
        setImmediate(async () => {
          try {
            const decryptedTokens = {
              access_token: decrypt(activeChannel.accessToken),
              refresh_token: activeChannel.refreshToken ? decrypt(activeChannel.refreshToken) : undefined,
              expiry_date: activeChannel.expiryDate
            };
            const youtube = getYouTubeClient(decryptedTokens, null, activeChannel._id);
            const channelRes = await youtube.channels.list({ part: 'snippet,statistics', mine: true });
            const channelItem = channelRes.data?.items?.[0];
            if (channelItem) {
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
          } catch (e) {
            // Background refresh error ignored — DB copy remains available
          }
        });
      }
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
          userId: userMatchFilter,
          channelId: typeof channelFilter === 'string' ? channelFilter : { $in: channelIds },
          isBotReply: { $ne: true },
          $and: [commentDateWindow]
        }
      },
      {
        $addFields: {
          // Keep AI-detected language buckets honest. Unknown data should not be counted as English.
          normalizedLang: {
            $cond: [
              { $or: [
                { $eq: ['$language', null] },
                { $eq: ['$language', ''] },
                { $eq: [{ $toLower: { $ifNull: ['$language', ''] } }, 'unknown'] }
              ]},
              'Unknown',
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
          userId: userMatchFilter,
          channelId: typeof channelFilter === 'string' ? channelFilter : { $in: channelIds },
          $and: [commentDateWindow],
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

    // 11. Fetch latest 10 activities for Live Feed
    const latestComments = await Comment.find({
      userId: userMatchFilter,
      channelId: typeof channelFilter === 'string' ? channelFilter : { $in: channelIds },
      isBotReply: { $ne: true }
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

    const activities = latestComments.map(c => {
      let type = 'analyze';
      if (c.status === 'deleted') type = 'delete';
      else if (c.status === 'flagged') type = 'hold';
      else if (c.autoLiked) type = 'like';
      
      return {
        _id: c._id,
        text: c.text,
        author: c.author,
        type,
        confidence: c.confidence,
        createdAt: c.createdAt
      };
    });

    res.json({
      activities,
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
      liveViewers: liveViewers || 0,
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
    const userIds = [req.user.id];

    const filter = { userId: { $in: userIds } };

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

/**
 * GET /api/analytics/overview
 * Returns overview statistics (totalComments, positive, negative, toxic, autoReplies, moderated, leads)
 */
export const getAnalyticsOverview = async (req, res) => {
  try {
    const userId = req.user.id;
    const channels = await Channel.find({ userId }).select('channelId').lean();
    const channelIds = channels.map(c => c.channelId);

    const filter = { userId, channelId: { $in: channelIds } };

    const totalComments = await Comment.countDocuments(filter);
    const positiveComments = await Comment.countDocuments({ ...filter, $or: [{ sentiment: { $in: ['positive', 'Positive', 'POSITIVE'] } }, { classification: { $in: ['positive', 'Positive', 'POSITIVE'] } }] });
    const negativeComments = await Comment.countDocuments({ ...filter, $or: [{ sentiment: { $in: ['negative', 'Negative', 'NEGATIVE'] } }, { classification: { $in: ['negative', 'Negative', 'NEGATIVE'] } }] });
    const toxicComments = await Comment.countDocuments({ ...filter, $or: [{ sentiment: { $in: ['toxic', 'Toxic', 'TOXIC'] } }, { classification: { $in: ['toxic', 'Toxic', 'TOXIC'] } }] });
    const autoReplies = await AutoReplyLog.countDocuments({ userId, channelId: { $in: channelIds } });
    const moderatedComments = await ModerationLog.countDocuments({ userId, channelId: { $in: channelIds } });
    const leads = await Lead.countDocuments({ userId, channelId: { $in: channelIds } });

    return res.json({
      success: true,
      data: {
        totalComments,
        positiveComments,
        negativeComments,
        toxicComments,
        autoReplies,
        moderatedComments,
        leads
      }
    });
  } catch (error) {
    logger.error('Error in getAnalyticsOverview:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch analytics overview' });
  }
};

/**
 * GET /api/analytics/sentiment-breakdown
 * Returns breakdown of comment sentiments (positive, neutral, negative, toxic)
 */
export const getSentimentBreakdown = async (req, res) => {
  try {
    const userId = req.user.id;
    const channels = await Channel.find({ userId }).select('channelId').lean();
    const channelIds = channels.map(c => c.channelId);

    const filter = { userId, channelId: { $in: channelIds } };

    const positive = await Comment.countDocuments({ ...filter, $or: [{ sentiment: { $in: ['positive', 'Positive', 'POSITIVE'] } }, { classification: { $in: ['positive', 'Positive', 'POSITIVE'] } }] });
    const neutral = await Comment.countDocuments({ ...filter, $or: [{ sentiment: { $in: ['neutral', 'Neutral', 'NEUTRAL'] } }, { classification: { $in: ['neutral', 'Neutral', 'NEUTRAL'] } }] });
    const negative = await Comment.countDocuments({ ...filter, $or: [{ sentiment: { $in: ['negative', 'Negative', 'NEGATIVE'] } }, { classification: { $in: ['negative', 'Negative', 'NEGATIVE'] } }] });
    const toxic = await Comment.countDocuments({ ...filter, $or: [{ sentiment: { $in: ['toxic', 'Toxic', 'TOXIC'] } }, { classification: { $in: ['toxic', 'Toxic', 'TOXIC'] } }] });

    return res.json({
      success: true,
      data: {
        positive,
        neutral,
        negative,
        toxic
      }
    });
  } catch (error) {
    logger.error('Error in getSentimentBreakdown:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch sentiment breakdown' });
  }
};

/**
 * GET /api/analytics/top-videos
 * Returns top-performing YouTube videos for the authenticated user (max 10)
 */
export const getTopVideos = async (req, res) => {
  try {
    const userId = req.user.id;
    const channels = await Channel.find({ userId }).select('channelId').lean();
    if (!channels || channels.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No video analytics found'
      });
    }

    const channelIds = channels.map(c => c.channelId);

    const topVideos = await Video.find({
      userId,
      channelId: { $in: channelIds }
    })
      .select('videoId title thumbnail statistics engagementRate')
      .sort({
        'statistics.viewCount': -1,
        'statistics.likeCount': -1,
        'statistics.commentCount': -1,
        engagementRate: -1,
        updatedAt: -1
      })
      .limit(10)
      .lean();

    if (!topVideos || topVideos.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No video analytics found'
      });
    }

    const result = topVideos.map(video => {
      const views = Number(video.statistics?.viewCount || 0);
      const likes = Number(video.statistics?.likeCount || 0);
      const comments = Number(video.statistics?.commentCount || 0);
      const engagement = typeof video.engagementRate === 'number'
        ? video.engagementRate
        : (views > 0 ? Number((((likes + comments) / views) * 100).toFixed(2)) : 0);

      return {
        videoId: video.videoId,
        title: video.title,
        thumbnail: video.thumbnail || '',
        views,
        likes,
        comments,
        engagement
      };
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error in getTopVideos:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch top videos' });
  }
};
