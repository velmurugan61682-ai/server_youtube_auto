import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Comment from '../models/Comment.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/youtube_auto');
  console.log('--- DB CONNECTED ---');

  const users = await User.find({}).lean();
  console.log('Users:', users.map(u => ({ id: u._id.toString(), email: u.email, name: u.name, orgId: u.organizationId })));

  const channels = await Channel.find({}).lean();
  console.log('Channels:', channels.map(c => ({ channelId: c.channelId, title: c.title, userId: c.userId, orgId: c.organizationId })));

  const deletedComments = await Comment.find({ status: { $in: ['deleted', 'hidden', 'flagged'] } }).lean();
  console.log(`Deleted/Hidden Comments in Comment collection: ${deletedComments.length}`);
  deletedComments.forEach(c => {
    console.log(`- Comment ${c._id} / ${c.youtubeId}: text="${c.text}", status="${c.status}", sentiment="${c.sentiment}", channelId="${c.channelId}", userId="${c.userId}"`);
  });

  const modLogs = await ModerationLog.find({}).lean();
  console.log(`ModerationLog count: ${modLogs.length}`);
  modLogs.forEach(m => {
    console.log(`- ModLog ${m._id}: commentId="${m.commentId}", action="${m.action}", executedAction="${m.executedAction}", status="${m.status}", channelId="${m.channelId}", userId="${m.userId}"`);
  });

  const autoReplyLogs = await AutoReplyLog.find({}).lean();
  console.log(`AutoReplyLog count: ${autoReplyLogs.length}`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
