import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Comment from '../models/Comment.mjs';
import Lead from '../models/Lead.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import AutoLikeLog from '../models/AutoLikeLog.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';
import { normalizeLanguage } from '../services/aiService.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to Database');

    // Fetch all users
    const users = await User.find({});
    console.log(`Found ${users.length} users in database.`);

    for (const user of users) {
      const targetUserId = user._id;
      const targetOrgId = user.organizationId;
      
      // Find connected channels for this user
      const channelDocs = await Channel.find({ userId: targetUserId });
      if (channelDocs.length === 0) continue;
      
      console.log(`\nRestoring comments for user ${user.email} (Org: ${targetOrgId})...`);

      for (const channel of channelDocs) {
        const channelId = channel.channelId;

        // Collect all comment IDs across logs for this user/channel
        const mLogs = await ModerationLog.find({ userId: targetUserId, channelId });
        const rLogs = await AutoReplyLog.find({ userId: targetUserId, channelId });
        const lLogs = await Lead.find({ userId: targetUserId, channelId });
        const lkLogs = await AutoLikeLog.find({ userId: targetUserId, channelId });

        const commentIds = new Set();
        mLogs.forEach(log => commentIds.add(log.commentId));
        rLogs.forEach(log => commentIds.add(log.commentId));
        lLogs.forEach(log => commentIds.add(log.commentId));
        lkLogs.forEach(log => commentIds.add(log.commentId));

        if (commentIds.size === 0) continue;
        console.log(`  Channel ${channel.title} (${channelId}): Found ${commentIds.size} unique comment IDs in logs.`);

        let inserted = 0;
        for (const cid of commentIds) {
          // Find logs matching this comment ID
          const mLog = mLogs.find(log => log.commentId === cid);
          const rLog = rLogs.find(log => log.commentId === cid);
          const lLog = lLogs.find(log => log.commentId === cid);
          const lkLog = lkLogs.find(log => log.commentId === cid);

          // Extract text and author details
          const text = mLog?.commentText || rLog?.commentText || lLog?.originalComment || 'Dummy comment text';
          const author = mLog?.authorName || rLog?.username || lLog?.authorName || 'Anonymous';
          const videoId = mLog?.videoId || rLog?.videoId || lLog?.videoId || lkLog?.videoId || 'unknown_video';
          const date = mLog?.createdAt || rLog?.createdAt || lLog?.createdAt || lkLog?.createdAt || new Date();

          const isModerated = !!mLog;
          const hasReplied = !!rLog;
          const autoLiked = !!lkLog;

          let status = 'approved';
          let sentiment = 'neutral';
          let classification = 'Neutral';

          if (isModerated) {
            classification = 'Toxic';
            sentiment = 'toxic';
            status = (mLog.action === 'deleted' || mLog.executedAction === 'deleted') ? 'deleted' : 'flagged';
          } else if (hasReplied) {
            classification = 'Positive';
            sentiment = 'positive';
          }

          const commentLanguage = normalizeLanguage(null, text);

          const commentDoc = {
            userId: targetUserId,
            organizationId: targetOrgId,
            youtubeId: cid,
            commentId: cid,
            channelId: channelId,
            videoId: videoId,
            text: text,
            commentText: text,
            author: author,
            username: author,
            authorProfileImageUrl: '',
            publishedAt: date,
            sentiment,
            classification,
            language: commentLanguage,
            status,
            isModerated,
            moderationAction: isModerated ? (mLog.action || 'delete') : null,
            hasReplied,
            replyText: rLog?.replyText || null,
            replyStatus: hasReplied ? 'sent' : 'none',
            autoLiked,
            likeStatus: autoLiked ? 'success' : 'none',
            aiStatus: 'completed',
            createdAt: date,
            updatedAt: date
          };

          await Comment.findOneAndUpdate(
            { userId: targetUserId, youtubeId: cid },
            { $set: commentDoc },
            { upsert: true }
          );
          inserted++;
        }
        console.log(`  ✅ Successfully restored ${inserted} comments for channel ${channel.title}.`);
      }
    }

    console.log('\nAll user comments restored successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error recovering database:', err);
    process.exit(1);
  }
}

run();
