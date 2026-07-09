import mongoose from 'mongoose';
import Comment from '../models/Comment.mjs';
import Lead from '../models/Lead.mjs';
import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';
import AutoLikeLog from '../models/AutoLikeLog.mjs';

export const getAnalytics = async (req, res) => {
  try {
    const { channelId } = req.query;
    
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

    const aggMatch = { 
      channelId: { $in: channelIds },
      userId: { $in: userIds }
    };
    
    if (channelId) {
      if (channelIds.includes(channelId)) {
        aggMatch.channelId = channelId;
      } else {
        return res.json({
          totalComments: 0,
          toxicDeleted: 0,
          positiveLiked: 0,
          pendingModeration: 0,
          totalLeads: 0,
          categories: [],
          languages: [],
          topCategories: [],
          activities: []
        });
      }
    }

    // ✅ PERFORMANCE: Combined all queries into single aggregation pipeline
    const results = await Comment.aggregate([
      { $match: aggMatch },
      { $facet: {
          totalComments: [
            { $count: 'count' }
          ],
          toxicDeleted: [
            { $match: { status: 'deleted' } },
            { $count: 'count' }
          ],
          pendingModeration: [
            { $match: { status: { $in: ['pending', 'flagged'] } } },
            { $count: 'count' }
          ],
          sentimentCounts: [
            { $group: { _id: '$sentiment', count: { $sum: 1 } } }
          ],
          languageCounts: [
            { $group: { _id: '$language', count: { $sum: 1 } } }
          ],
          wordCategoryCounts: [
            { $unwind: '$detectedWords' },
            { $group: { _id: '$detectedWords.category', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
          ],
          recentActivities: [
            { $sort: { updatedAt: -1 } },
            { $limit: 5 }
          ]
        }
      }
    ]);

    const data = results[0];
    
    const totalComments = data.totalComments[0]?.count || 0;
    const toxicDeleted = data.toxicDeleted[0]?.count || 0;
    const pendingModeration = data.pendingModeration[0]?.count || 0;
    const sentimentCounts = data.sentimentCounts;
    const languageCounts = data.languageCounts;
    const wordCategoryCounts = data.wordCategoryCounts;

    const activities = data.recentActivities.map(c => ({
      ...c,
      id: c._id,
      type: c.status === 'deleted' ? 'delete' : (c.autoLiked ? 'like' : 'new_comment')
    }));

    // Count total leads for tenant channels
    const totalLeads = await Lead.countDocuments({ 
      channelId: { $in: channelIds }, 
      userId: { $in: userIds },
      ...(channelId && { channelId }) 
    });

    // Count total positiveLiked from AutoLikeLog matching organization/user channels
    const positiveLiked = await AutoLikeLog.countDocuments({
      userId: { $in: userIds },
      channelId: { $in: channelIds },
      autoLiked: true,
      ...(channelId && { channelId })
    });

    res.json({
      totalComments,
      toxicDeleted,
      positiveLiked,
      pendingModeration,
      totalLeads,
      categories: sentimentCounts,
      languages: languageCounts,
      topCategories: wordCategoryCounts,
      activities
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
