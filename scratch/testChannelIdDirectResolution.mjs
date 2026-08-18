import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import Channel from '../models/Channel.mjs';
import Video from '../models/Video.mjs';
import Comment from '../models/Comment.mjs';
import User from '../models/User.mjs';

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const testUser = await User.findOne({ email: 'velmurugan61682@gmail.com' }).lean();
    console.log('Test User:', testUser.email, '| Org:', testUser.organizationId);

    const channelId = 'UCdpaYm53cdH0SODoBXAKRmQ';

    let allowedChannelIds = [];
    if (channelId) {
      const targetChannel = await Channel.findOne({ channelId }).select('channelId').lean();
      if (targetChannel) {
        allowedChannelIds = [targetChannel.channelId];
      }
    }

    console.log('allowedChannelIds:', allowedChannelIds);

    let replyQuery = { channelId: { $in: allowedChannelIds } };
    let modQuery = { channelId: { $in: allowedChannelIds } };
    let commentQuery = {
      channelId: { $in: allowedChannelIds },
      $or: [
        { replyText: { $exists: true, $ne: '' } },
        { aiReply: { $exists: true, $ne: '' } },
        { status: { $in: ['deleted', 'hidden', 'flagged', 'replied'] } }
      ]
    };

    const [allReplies, allMods, allComments] = await Promise.all([
      AutoReplyLog.find(replyQuery).sort({ createdAt: -1 }).lean(),
      ModerationLog.find(modQuery).sort({ createdAt: -1 }).lean(),
      Comment.find(commentQuery).sort({ publishedAt: -1, createdAt: -1 }).lean()
    ]);

    const replyItems = allReplies.map(r => ({
      id: r._id.toString(),
      type: 'replied',
      status: r.status === 'success' ? 'success' : 'failed',
      authorName: r.username || 'Anonymous',
      commentText: r.commentText || '',
      replyText: r.replyText || r.aiReply || '',
      actionDate: r.createdAt
    }));

    const modItems = allMods.map(m => {
      const execAction = m.executedAction || m.action || 'deleted';
      const historyType = execAction === 'delete' || execAction === 'deleted' ? 'deleted' : 'hidden';
      const isSuccess = m.status === 'Success' || m.status === 'success';
      return {
        id: m._id.toString(),
        type: historyType,
        status: isSuccess ? 'success' : 'failed',
        authorName: m.authorName || 'Anonymous',
        commentText: m.commentText || '',
        replyText: null,
        actionDate: m.createdAt
      };
    });

    const commentItems = allComments.map(c => {
      const isDeleted = c.status === 'deleted' || c.status === 'hidden';
      return {
        id: c._id.toString(),
        type: isDeleted ? (c.status === 'deleted' ? 'deleted' : 'hidden') : 'replied',
        status: 'success',
        authorName: c.author || c.authorName || c.username || 'Anonymous',
        commentText: c.text || c.commentText || '',
        replyText: c.replyText || c.aiReply || '',
        actionDate: c.publishedAt || c.createdAt || new Date()
      };
    });

    const mergedRaw = [...modItems, ...replyItems, ...commentItems];
    const seenHistoryKeys = new Set();
    let merged = [];
    for (const item of mergedRaw) {
      const authorClean = (item.authorName || '').trim().toLowerCase();
      const commentClean = (item.commentText || '').trim().toLowerCase();
      const key = `${authorClean}:${commentClean}`;
      if (commentClean && !seenHistoryKeys.has(key)) {
        seenHistoryKeys.add(key);
        merged.push(item);
      }
    }

    const totalReplied = merged.filter(i => i.type === 'replied' && i.status === 'success').length;
    const totalDeleted = merged.filter(i => i.type === 'deleted' && i.status === 'success').length;
    const totalHidden = merged.filter(i => i.type === 'hidden' && i.status === 'success').length;
    const totalFailed = merged.filter(i => i.status === 'failed').length;
    const totalAll = merged.length;
    const totalSuccess = merged.filter(i => i.status === 'success').length;
    const successRate = totalAll > 0 ? Math.round((totalSuccess / totalAll) * 100) : 0;

    console.log('\n--- COMPUTED SUMMARY STATS ---');
    console.log(`Total Actions: ${totalAll}`);
    console.log(`AI Replies: ${totalReplied}`);
    console.log(`Deleted: ${totalDeleted}`);
    console.log(`Hidden: ${totalHidden}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Success Rate: ${successRate}%`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
