import Comment from '../models/Comment.mjs';
import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import logger from '../utils/logger.mjs';

export const getDashboardStats = async (req, res) => {
  try {
    // Resolve organization channels & users concurrently
    const filter = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }] }
      : { userId: req.user.id };
    const filterUser = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { _id: req.user.id }] }
      : { _id: req.user.id };

    const [channels, users] = await Promise.all([
      Channel.find(filter).select('channelId').lean(),
      User.find(filterUser).select('_id').lean()
    ]);

    const channelIds = channels.map(c => c.channelId);
    const userIds = users.map(u => u._id);

    const userFilter = { $in: userIds };
    const channelFilter = { $in: channelIds };

    // Execute all count queries in parallel
    const [
      toxicComments,
      autoShieldMod,
      autoShieldDeleted,
      autoReplies,
      positiveComments,
      moderateComments
    ] = await Promise.all([
      Comment.countDocuments({
        userId: userFilter,
        channelId: channelFilter,
        sentiment: 'toxic'
      }),
      ModerationLog.countDocuments({
        userId: userFilter,
        channelId: channelFilter,
        status: { $ne: 'Failed' }
      }),
      Comment.countDocuments({
        userId: userFilter,
        channelId: channelFilter,
        $or: [
          { status: { $in: ['deleted', 'hidden'] } },
          { moderationStatus: { $in: ['deleted', 'hidden', 'heldForReview'] } },
          { isModerated: true, sentiment: 'toxic' }
        ]
      }),
      AutoReplyLog.countDocuments({
        userId: userFilter,
        channelId: channelFilter,
        status: 'success'
      }),
      Comment.countDocuments({
        userId: userFilter,
        channelId: channelFilter,
        sentiment: 'positive'
      }),
      Comment.countDocuments({
        userId: userFilter,
        channelId: channelFilter,
        $or: [
          { sentiment: 'moderate' },
          { status: { $in: ['moderate', 'flagged', 'pending'] } },
          { moderationStatus: { $in: ['needsReview', 'heldForReview'] } }
        ]
      })
    ]);

    // autoShield = max of (ModerationLog success count, Comment deleted/hidden count)
    // to avoid double-counting when both records exist for the same deletion
    const autoShield = Math.max(autoShieldMod, autoShieldDeleted);

    logger.info(`[Dashboard Stats] Calculated for user ${req.user.id}: toxicComments=${toxicComments}, autoShield=${autoShield}, autoReplies=${autoReplies}, positiveComments=${positiveComments}, moderateComments=${moderateComments}`);

    return res.json({
      toxicComments,
      autoShield,
      autoReplies,
      positiveComments,
      moderateComments
    });
  } catch (error) {
    logger.error(`[Dashboard Stats] Error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
};
