import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import Video from '../models/Video.mjs';
import { getYouTubeClient, fetchLatestComments } from '../services/youtubeService.mjs';
import { decrypt } from '../utils/cryptoHelper.mjs';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const channel = await Channel.findOne({ channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' });
    if (!channel) {
      console.log('Channel not found in DB!');
      process.exit(1);
    }

    const tokens = {
      access_token: decrypt(channel.accessToken),
      refresh_token: decrypt(channel.refreshToken),
      expiry_date: channel.expiryDate
    };

    const youtube = getYouTubeClient(tokens, null, channel._id);
    const comments = await fetchLatestComments(youtube, channel.channelId, 50);

    console.log(`\nFound ${comments.length} comments from YouTube API:`);
    for (const c of comments) {
      const dbComment = await Comment.findOne({ youtubeId: c.youtubeId });
      const dbVideo = await Video.findOne({ videoId: c.videoId });
      console.log(`- Text: "${c.text.substring(0, 50)}"`);
      console.log(`  YouTube ID: ${c.youtubeId}`);
      console.log(`  Video ID: ${c.videoId} (In DB: ${dbVideo ? 'YES - ' + dbVideo.title : 'NO'})`);
      console.log(`  isReply: ${c.isReply}`);
      console.log(`  In DB: ${dbComment ? 'YES' : 'NO'}`);
      console.log('----------------------------------------------------');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error fetching comments:', err);
    process.exit(1);
  }
}

run();
