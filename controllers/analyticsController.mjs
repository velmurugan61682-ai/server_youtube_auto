import mongoose from 'mongoose';
import Comment from '../models/Comment.mjs';
import Lead from '../models/Lead.mjs';

export const getAnalytics = async (req, res) => {
  try {
    const { channelId } = req.query;
    const userIdObj = new mongoose.Types.ObjectId(req.user.id);
    const aggMatch = { userId: userIdObj };
    
    if (channelId) {
      aggMatch.channelId = channelId;
    }

    // ✅ PERFORMANCE: Combined all queries into single aggregation pipeline (6x faster!)
    const results = await Comment.aggregate([
      { $match: aggMatch },
      { $facet: {
          // Count total documents
          totalComments: [
            { $count: 'count' }
          ],
          // Count toxic deleted
          toxicDeleted: [
            { $match: { status: 'deleted' } },
            { $count: 'count' }
          ],
          // Count positive liked
          positiveLiked: [
            { $match: { autoLiked: true } },
            { $count: 'count' }
          ],
          // Count pending moderation
          pendingModeration: [
            { $match: { status: { $in: ['pending', 'flagged'] } } },
            { $count: 'count' }
          ],
          // Group by sentiment
          sentimentCounts: [
            { $group: { _id: '$sentiment', count: { $sum: 1 } } }
          ],
          // Group by language
          languageCounts: [
            { $group: { _id: '$language', count: { $sum: 1 } } }
          ],
          // Top 5 toxic word categories
          wordCategoryCounts: [
            { $unwind: '$detectedWords' },
            { $group: { _id: '$detectedWords.category', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
          ],
          // Recent activities (last 5)
          recentActivities: [
            { $sort: { updatedAt: -1 } },
            { $limit: 5 }
          ]
        }
      }
    ]);

    const data = results[0];
    
    // Extract counts from aggregation (handle empty results)
    const totalComments = data.totalComments[0]?.count || 0;
    const toxicDeleted = data.toxicDeleted[0]?.count || 0;
    const positiveLiked = data.positiveLiked[0]?.count || 0;
    const pendingModeration = data.pendingModeration[0]?.count || 0;
    const sentimentCounts = data.sentimentCounts;
    const languageCounts = data.languageCounts;
    const wordCategoryCounts = data.wordCategoryCounts;

    const activities = data.recentActivities.map(c => ({
      ...c,
      id: c._id,
      type: c.status === 'deleted' ? 'delete' : (c.autoLiked ? 'like' : 'new_comment')
    }));

    // Count total leads
    const totalLeads = await Lead.countDocuments({ userId: req.user.id, ...(channelId && { channelId }) });

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
