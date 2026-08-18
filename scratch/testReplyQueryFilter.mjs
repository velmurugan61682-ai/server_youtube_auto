import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const adminUser = await User.findOne({ email: 'admin@channelbot.in' }).lean();
    const channelId = 'UCdpaYm53cdH0SODoBXAKRmQ';

    const isAdmin = adminUser.role === 'admin' || adminUser.isAdmin;
    let channelFilter = {};
    if (isAdmin) {
      channelFilter = channelId ? { channelId } : {};
    }

    const ownedChannels = await Channel.find(channelFilter).select('channelId').lean();
    const allowedChannelIds = ownedChannels.map(c => c.channelId);
    console.log('allowedChannelIds:', allowedChannelIds);

    const orgUserFilter = isAdmin
      ? {}
      : (adminUser.organizationId ? { $or: [{ organizationId: adminUser.organizationId }, { _id: adminUser._id }] } : { _id: adminUser._id });
    const orgUsers = await User.find(orgUserFilter).select('_id').lean();
    const orgUserIds = orgUsers.map(u => u._id);
    console.log('orgUserIds count:', orgUserIds.length);

    let replyQuery = { channelId: { $in: allowedChannelIds } };
    if (!isAdmin) {
      replyQuery.$or = [{ userId: { $in: orgUserIds } }, { channelId: { $in: allowedChannelIds } }];
    }

    const replies = await AutoReplyLog.find(replyQuery).lean();
    console.log(`AutoReplyLog count with updated replyQuery: ${replies.length}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
