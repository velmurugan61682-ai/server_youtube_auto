import ModerationLog from '../models/ModerationLog.mjs';
import Comment from '../models/Comment.mjs';
import Organization from '../models/Organization.mjs';
import logger from '../utils/logger.mjs';

/**
 * GET /api/admin/moderation/stats
 * Admin-only endpoint aggregating moderation stats across ALL organizations
 */
export const getAdminModerationStats = async (req, res) => {
  try {
    // 1. Overall counts across all organizations
    const totalDeleted = await Comment.countDocuments({ status: 'deleted' });
    const totalHeld = await Comment.countDocuments({ status: 'flagged' });
    const totalModerated = totalDeleted + totalHeld;

    // 2. Comments removed/held per day (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyActivity = await ModerationLog.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            action: '$executedAction'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Format daily stats
    const dailyStatsMap = {};
    dailyActivity.forEach(item => {
      const date = item._id.date;
      const action = item._id.action || 'unknown';
      if (!dailyStatsMap[date]) {
        dailyStatsMap[date] = { date, deleted: 0, hold: 0, total: 0 };
      }
      if (action === 'delete') dailyStatsMap[date].deleted += item.count;
      else if (action === 'hold') dailyStatsMap[date].hold += item.count;
      dailyStatsMap[date].total += item.count;
    });
    const dailyStats = Object.values(dailyStatsMap);

    // 3. Category breakdown across all organizations
    const categoryBreakdown = await ModerationLog.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$confidence' },
          avgToxicityScore: { $avg: '$toxicityScore' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // 4. Per-organization activity breakdown
    const perOrgActivity = await ModerationLog.aggregate([
      {
        $group: {
          _id: '$organizationId',
          totalActions: { $sum: 1 },
          lastActionAt: { $max: '$createdAt' }
        }
      },
      { $sort: { totalActions: -1 } },
      { $limit: 20 }
    ]);

    // Populate Organization names
    const orgIds = perOrgActivity.map(o => o._id).filter(Boolean);
    const orgDocs = await Organization.find({ _id: { $in: orgIds } }).select('name logo').lean();
    const orgNameMap = {};
    orgDocs.forEach(org => {
      orgNameMap[org._id.toString()] = org.name;
    });

    const perOrgStats = perOrgActivity.map(item => ({
      organizationId: item._id,
      organizationName: item._id ? (orgNameMap[item._id.toString()] || 'Unknown Org') : 'Unassigned',
      totalActions: item.totalActions,
      lastActionAt: item.lastActionAt
    }));

    res.json({
      success: true,
      summary: {
        totalModerated,
        totalDeleted,
        totalHeld
      },
      dailyStats,
      categoryBreakdown,
      perOrgStats
    });
  } catch (error) {
    logger.error('Error in getAdminModerationStats:', error);
    res.status(500).json({ error: error.message });
  }
};
