import Comment from '../models/Comment.mjs';
import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import logger from '../utils/logger.mjs';

export const getDashboardStats = async (req, res) => {
  try {
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

    const userFilter = { $in: userIds };
    const channelFilter = { $in: channelIds };

    // 1. toxicComments: count of Comments in database with sentiment = 'toxic'
    const toxicComments = await Comment.countDocuments({
      userId: userFilter,
      channelId: channelFilter,
      sentiment: 'toxic'
    });

    // 2. autoShield: count of ModerationLog records with status 'Success'
    const autoShield = await ModerationLog.countDocuments({
      userId: userFilter,
      channelId: channelFilter,
      status: 'Success'
    });

    // 3. autoReplies: count of AutoReplyLog records with status 'success'
    const autoReplies = await AutoReplyLog.countDocuments({
      userId: userFilter,
      channelId: channelFilter,
      status: 'success'
    });

    // 4. positiveComments: count of Comments with sentiment = 'positive'
    const positiveComments = await Comment.countDocuments({
      userId: userFilter,
      channelId: channelFilter,
      sentiment: 'positive'
    });

    // 5. moderateComments: count of Comments with status 'pending' or 'flagged'
    const moderateComments = await Comment.countDocuments({
      userId: userFilter,
      channelId: channelFilter,
      status: { $in: ['pending', 'flagged'] }
    });

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
