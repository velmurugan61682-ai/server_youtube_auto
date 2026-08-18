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

    const adminUser = await User.findOne({ email: 'admin@channelbot.in' }).lean();
    const req = {
      user: {
        id: adminUser._id.toString(),
        role: adminUser.role,
        isAdmin: true,
        organizationId: adminUser.organizationId ? adminUser.organizationId.toString() : null
      },
      query: { channelId: 'UCdpaYm53cdH0SODoBXAKRmQ' }
    };

    const { channelId, type = 'all', search = '', page = 1, limit = 20 } = req.query;
    const isAdmin = req.user.role === 'admin' || req.user.isAdmin;
    let channelFilter = {};
    if (isAdmin) {
      channelFilter = channelId ? { channelId } : {};
    }

    const ownedChannels = await Channel.find(channelFilter).select('channelId').lean();
    const allowedChannelIds = ownedChannels.map(c => c.channelId);

    const searchRegex = search ? new RegExp(search, 'i') : null;

    let replyQuery = { channelId: { $in: allowedChannelIds } };
    if (channelId) replyQuery.channelId = channelId;
    if (searchRegex) {
      replyQuery.$or = [
        { username: searchRegex },
        { commentText: searchRegex },
        { replyText: searchRegex }
      ];
    }

    let modQuery = { channelId: { $in: allowedChannelIds } };
    if (channelId) modQuery.channelId = channelId;
    if (searchRegex) {
      modQuery.$or = [
        { authorName: searchRegex },
        { commentText: searchRegex }
      ];
    }

    let commentQuery = { channelId: { $in: allowedChannelIds }, $or: [{ replyText: { $exists: true, $ne: '' } }, { aiReply: { $exists: true, $ne: '' } }, { status: { $in: ['deleted', 'hidden', 'flagged', 'replied'] } }] };
    if (channelId) commentQuery.channelId = channelId;

    const [allReplies, allMods, allComments] = await Promise.all([
      AutoReplyLog.find(replyQuery).sort({ createdAt: -1 }).lean(),
      ModerationLog.find(modQuery).sort({ createdAt: -1 }).lean(),
      Comment.find(commentQuery).sort({ publishedAt: -1, createdAt: -1 }).lean()
    ]);

    console.log(`Fetched ${allReplies.length} replies, ${allMods.length} mods, ${allComments.length} comments from DB`);

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

    console.log(`Deduplicated Merged Total: ${merged.length} items`);
    console.log('Sample History Items:', merged.slice(0, 3));

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
