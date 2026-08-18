import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import CommentAutomationLog from '../models/CommentAutomationLog.mjs';
import Comment from '../models/Comment.mjs';
import Channel from '../models/Channel.mjs';

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const autoReplyLogsCount = await AutoReplyLog.countDocuments({});
    const moderationLogsCount = await ModerationLog.countDocuments({});
    const commentAutomationLogsCount = await CommentAutomationLog.countDocuments({});
    const commentsCount = await Comment.countDocuments({});
    const channelsCount = await Channel.countDocuments({});

    console.log(`AutoReplyLog count: ${autoReplyLogsCount}`);
    console.log(`ModerationLog count: ${moderationLogsCount}`);
    console.log(`CommentAutomationLog count: ${commentAutomationLogsCount}`);
    console.log(`Comment count: ${commentsCount}`);
    console.log(`Channel count: ${channelsCount}`);

    const sampleComments = await Comment.find({}).limit(5).lean();
    console.log('\nSample Comments from Comment collection:');
    sampleComments.forEach(c => {
      console.log(`- Channel: ${c.channelId} | Author: ${c.author || c.username} | Text: ${c.text || c.commentText} | Reply: ${c.replyText || c.aiReply} | Status: ${c.status}`);
    });

    const sampleAutoReply = await AutoReplyLog.find({}).limit(5).lean();
    console.log('\nSample AutoReplyLogs:');
    sampleAutoReply.forEach(a => {
      console.log(`- Channel: ${a.channelId} | User: ${a.username} | Text: ${a.commentText} | Reply: ${a.replyText} | Status: ${a.status}`);
    });

    const sampleCommentAutomationLogs = await CommentAutomationLog.find({}).limit(5).lean();
    console.log('\nSample CommentAutomationLogs:');
    sampleCommentAutomationLogs.forEach(cal => {
      console.log(`- Channel: ${cal.channelId} | Author: ${cal.authorName} | Text: ${cal.commentText} | Reply: ${cal.generatedReply} | Status: ${cal.status}`);
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
