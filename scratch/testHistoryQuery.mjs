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

    const channelId = 'UCdpaYm53cdH0SODoBXAKRmQ';

    // Test simple channelId query
    const simpleReplies = await AutoReplyLog.find({ channelId }).lean();
    console.log(`AutoReplyLog with channelId='${channelId}': ${simpleReplies.length}`);

    const simpleMods = await ModerationLog.find({ channelId }).lean();
    console.log(`ModerationLog with channelId='${channelId}': ${simpleMods.length}`);

    // Test with admin user
    const adminUser = await User.findOne({ email: 'admin@channelbot.in' }).lean();
    console.log('\nAdmin User:', adminUser ? { id: adminUser._id, role: adminUser.role, org: adminUser.organizationId } : 'Not found');

    // Test with channel owner user
    const ownerUser = await User.findOne({ email: 'tech@gmail.com' }).lean();
    console.log('Owner User:', ownerUser ? { id: ownerUser._id, role: ownerUser.role, org: ownerUser.organizationId } : 'Not found');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
