import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import Video from '../models/Video.mjs';
import Comment from '../models/Comment.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import ModerationLog from '../models/ModerationLog.mjs';

dotenv.config();

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');

    const channels = await Channel.find({});
    console.log(`\n--- CHANNELS (${channels.length}) ---`);
    channels.forEach(c => {
      console.log(`Channel Title: ${c.title}, Channel ID: ${c.channelId}, User ID: ${c.userId}, Status: ${c.status}`);
    });

    const videos = await Video.find({});
    console.log(`\n--- VIDEOS (${videos.length}) ---`);
    videos.forEach(v => {
      console.log(`Video Title: ${v.title}, Video ID: ${v.videoId}, Channel ID: ${v.channelId}`);
    });

    const comments = await Comment.find({});
    console.log(`\n--- COMMENTS (${comments.length}) ---`);
    comments.forEach(c => {
      console.log(`Text: "${c.text}", YouTube ID: ${c.youtubeId}, Video ID: ${c.videoId}, Status: ${c.status}, Sentiment: ${c.sentiment}, hasReplied: ${c.hasReplied}`);
    });

    const replyLogs = await AutoReplyLog.find({});
    console.log(`\n--- AUTO REPLY LOGS (${replyLogs.length}) ---`);
    replyLogs.forEach(r => {
      console.log(`Comment ID: ${r.commentId}, Reply Text: "${r.replyText}", Status: ${r.status}`);
    });

    const modLogs = await ModerationLog.find({});
    console.log(`\n--- MODERATION LOGS (${modLogs.length}) ---`);
    modLogs.forEach(m => {
      console.log(`Comment ID: ${m.commentId}, Text: "${m.commentText}", Action: ${m.action}, Status: ${m.status}`);
    });

    console.log('\nDone.');
    process.exit(0);
  } catch (err) {
    console.error('Error running script:', err);
    process.exit(1);
  }
}

run();
