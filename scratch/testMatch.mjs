import '../config/env.mjs';
import mongoose from 'mongoose';
import Comment from '../models/Comment.mjs';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);

  const techUser = await User.findOne({ email: 'tech@gmail.com' }).lean();
  console.log('techUser ID:', techUser._id, 'orgId:', techUser.organizationId);

  // All users in tech's org:
  const orgUsers = await User.find({ organizationId: techUser.organizationId }).select('_id').lean();
  const orgUserIds = orgUsers.map(u => u._id);
  console.log('orgUserIds:', orgUserIds);

  const channels = await Channel.find({ userId: { $in: orgUserIds } }).select('channelId').lean();
  const channelIds = channels.map(c => c.channelId);
  console.log('channelIds for org:', channelIds);

  const commentsWithTechId = await Comment.countDocuments({ userId: techUser._id });
  const commentsWithOrgUserIds = await Comment.countDocuments({ userId: { $in: orgUserIds } });
  const commentsWithChannelIds = await Comment.countDocuments({ channelId: { $in: channelIds } });

  console.log('Comments with techUser._id:', commentsWithTechId);
  console.log('Comments with orgUserIds:', commentsWithOrgUserIds);
  console.log('Comments with channelIds:', commentsWithChannelIds);

  process.exit(0);
}

test();
