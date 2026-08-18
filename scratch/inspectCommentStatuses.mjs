import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import Comment from '../models/Comment.mjs';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const channelId = 'UCdpaYm53cdH0SODoBXAKRmQ';

    // Check all channels in DB
    const channels = await Channel.find({}).lean();
    console.log('Channels in DB:');
    channels.forEach(c => console.log(`- Title: '${c.title}', channelId: '${c.channelId}', userId: '${c.userId}', orgId: '${c.organizationId}'`));

    // Check comments status breakdown
    const commentStatuses = await Comment.aggregate([
      { $match: { channelId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log(`\nComment statuses for ${channelId}:`, commentStatuses);

    // Check auto reply log status breakdown
    const autoReplyStatuses = await AutoReplyLog.aggregate([
      { $match: { channelId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log(`\nAutoReplyLog statuses for ${channelId}:`, autoReplyStatuses);

    // Check moderation log status breakdown
    const moderationStatuses = await ModerationLog.aggregate([
      { $match: { channelId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log(`\nModerationLog statuses for ${channelId}:`, moderationStatuses);

    // Test querying history for each registered user
    const users = await User.find({}).lean();
    console.log('\n--- TESTING GET /api/comment-history FOR ALL USERS ---');
    for (const u of users) {
      const isAdmin = u.role === 'admin' || u.isAdmin;
      let channelFilter = {};
      if (isAdmin) {
        channelFilter = channelId ? { channelId } : {};
      } else if (u.organizationId) {
        channelFilter = channelId
          ? { $and: [{ $or: [{ organizationId: u.organizationId }, { userId: u._id }] }, { channelId }] }
          : { $or: [{ organizationId: u.organizationId }, { userId: u._id }] };
      } else {
        channelFilter = channelId ? { userId: u._id, channelId } : { userId: u._id };
      }

      const ownedChannels = await Channel.find(channelFilter).select('channelId').lean();
      const allowedChannelIds = ownedChannels.map(c => c.channelId);

      const countReplies = allowedChannelIds.length > 0 ? await AutoReplyLog.countDocuments({ channelId: { $in: allowedChannelIds } }) : 0;
      const countComments = allowedChannelIds.length > 0 ? await Comment.countDocuments({ channelId: { $in: allowedChannelIds } }) : 0;

      console.log(`User '${u.email}' (id: ${u._id}, role: ${u.role}, org: ${u.organizationId}) -> allowedChannels: [${allowedChannelIds.join(', ')}], AutoReplyLogs: ${countReplies}, Comments: ${countComments}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
