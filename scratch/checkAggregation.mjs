import '../config/env.mjs';
import mongoose from 'mongoose';
import Comment from '../models/Comment.mjs';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);

  const user = await User.findOne({ email: 'tech@gmail.com' }).lean();

  const userIds = [user._id];
  const channels = await Channel.find({ userId: user._id }).select('channelId').lean();
  const channelIds = channels.map(c => c.channelId);
  const channelFilter = { $in: channelIds };

  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const end = now;

  const commentDateWindow = {
    $or: [
      { publishedAt: { $gte: start, $lte: end } },
      { createdAt: { $gte: start, $lte: end } }
    ]
  };

  console.log('User IDs:', userIds);
  console.log('Channel IDs:', channelIds);
  console.log('Date range start:', start, 'end:', end);

  // Test match without commentDateWindow
  const langMatchNoDate = await Comment.aggregate([
    {
      $match: {
        userId: { $in: userIds },
        channelId: channelFilter,
        isBotReply: { $ne: true }
      }
    },
    { $group: { _id: '$language', count: { $sum: 1 } } }
  ]);
  console.log('Languages NO date filter:', langMatchNoDate);

  // Test match WITH commentDateWindow
  const langMatchWithDate = await Comment.aggregate([
    {
      $match: {
        userId: { $in: userIds },
        channelId: channelFilter,
        isBotReply: { $ne: true },
        $and: [commentDateWindow]
      }
    },
    { $group: { _id: '$language', count: { $sum: 1 } } }
  ]);
  console.log('Languages WITH date filter:', langMatchWithDate);

  // Test classification match
  const classMatchNoDate = await Comment.aggregate([
    {
      $match: {
        userId: { $in: userIds },
        channelId: channelFilter,
        classification: { $exists: true, $nin: [null, '', 'none', 'unknown', 'bot_reply'] }
      }
    },
    { $group: { _id: '$classification', count: { $sum: 1 } } }
  ]);
  console.log('Classifications NO date filter:', classMatchNoDate);

  const classMatchWithDate = await Comment.aggregate([
    {
      $match: {
        userId: { $in: userIds },
        channelId: channelFilter,
        $and: [commentDateWindow],
        classification: { $exists: true, $nin: [null, '', 'none', 'unknown', 'bot_reply'] }
      }
    },
    { $group: { _id: '$classification', count: { $sum: 1 } } }
  ]);
  console.log('Classifications WITH date filter:', classMatchWithDate);

  process.exit(0);
}

test();
