import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const ModerationLog = (await import('../models/ModerationLog.mjs')).default;
  const AutoReplyLog  = (await import('../models/AutoReplyLog.mjs')).default;
  const Comment       = (await import('../models/Comment.mjs')).default;
  const Channel       = (await import('../models/Channel.mjs')).default;
  const User          = (await import('../models/User.mjs')).default;

  // --- ModerationLog ---
  const mLogs = await ModerationLog.find({}).select('userId channelId commentId category executedAction action status reason createdAt').lean();
  console.log('\n=== ModerationLog (' + mLogs.length + ' records) ===');
  mLogs.forEach(m => console.log(JSON.stringify({
    userId: m.userId, channelId: m.channelId, commentId: m.commentId,
    category: m.category, executedAction: m.executedAction, action: m.action,
    status: m.status, created: m.createdAt
  })));

  // --- AutoReplyLog ---
  const aLogs = await AutoReplyLog.find({}).select('userId channelId commentId status createdAt').lean();
  console.log('\n=== AutoReplyLog (' + aLogs.length + ' records) ===');
  aLogs.forEach(a => console.log(JSON.stringify({
    userId: a.userId, channelId: a.channelId, commentId: a.commentId,
    status: a.status, created: a.createdAt
  })));

  // --- Comment sentiment distribution ---
  const sentiments = await Comment.aggregate([{ $group: { _id: '$sentiment', count: { $sum: 1 } } }]);
  console.log('\n=== Comment Sentiments ===');
  sentiments.forEach(s => console.log(`  ${s._id}: ${s.count}`));

  const statuses = await Comment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  console.log('\n=== Comment Statuses ===');
  statuses.forEach(s => console.log(`  ${s._id}: ${s.count}`));

  // --- Channel + User orgId chain ---
  const channels = await Channel.find({}).select('channelId title userId organizationId').lean();
  console.log('\n=== Channels ===');
  channels.forEach(c => console.log(JSON.stringify({ id: c._id, channelId: c.channelId, title: c.title, userId: c.userId, orgId: c.organizationId })));

  const users = await User.find({}).select('email role organizationId').lean();
  console.log('\n=== Users ===');
  users.forEach(u => console.log(JSON.stringify({ id: u._id, email: u.email, role: u.role, orgId: u.organizationId })));

  // Date range (last 30 days)
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = new Date();
  console.log('\n=== Date Range ===', start.toISOString(), 'to', end.toISOString());

  // Simulate analytics query for toxic
  const channelIds = channels.map(c => c.channelId);
  const userIds = users.map(u => u._id);
  console.log('\nchannelIds:', channelIds);
  console.log('userIds:', JSON.stringify(userIds));

  const toxicCount = await ModerationLog.countDocuments({
    userId: { $in: userIds },
    channelId: { $in: channelIds },
    status: { $in: ['Success', 'success'] },
    $or: [
      { executedAction: { $in: ['delete', 'hold', 'deleted', 'hidden'] } },
      { action: { $in: ['delete', 'hold', 'deleted', 'hidden'] } }
    ],
    createdAt: { $gte: start, $lte: end }
  });
  console.log('\n=== SIMULATED toxic query result:', toxicCount, '===');

  const posCount = await Comment.countDocuments({
    userId: { $in: userIds },
    channelId: { $in: channelIds },
    sentiment: 'positive',
    publishedAt: { $gte: start, $lte: end }
  });
  console.log('=== SIMULATED positive query result:', posCount, '===');

  const replyCount = await AutoReplyLog.countDocuments({
    userId: { $in: userIds },
    channelId: { $in: channelIds },
    status: { $in: ['success', 'Success'] },
    createdAt: { $gte: start, $lte: end }
  });
  console.log('=== SIMULATED autoreply query result:', replyCount, '===');

  await mongoose.disconnect();
};

run().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });
