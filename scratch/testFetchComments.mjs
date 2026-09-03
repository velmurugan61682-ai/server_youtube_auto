import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'server_youtube_auto', '.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: '.env' });
}

import { getYouTubeClientWithApiKey, fetchLatestComments } from '../services/youtubeService.mjs';
import Channel from '../models/Channel.mjs';
import Video from '../models/Video.mjs';

async function main() {
  console.log('=== YOUTUBE COMMENTS FETCH TEST ===\n');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  const channelId = process.env.YOUTUBE_CHANNEL_ID || 'UCyFw6NotahbWYQnWfWc7Wmw';
  console.log(`Testing comment fetching for Channel ID: ${channelId}...`);

  const youtube = getYouTubeClientWithApiKey(process.env.YOUTUBE_API_KEY);

  // 1. Try fetching comments by Channel ID
  try {
    const comments = await fetchLatestComments(youtube, channelId, 20);
    console.log(`\n✓ [CHANNEL COMMENTS SUCCESS] Fetched ${comments.length} comments directly by Channel ID (${channelId})!`);
    comments.slice(0, 5).forEach((c, i) => {
      console.log(`  [Comment ${i + 1}] Author: "${c.author}", Text: "${c.text}", VideoId: ${c.videoId}`);
    });
  } catch (err) {
    console.log(`⚠️ Channel-level comment fetch notice: ${err.message}`);
  }

  // 2. Try fetching comments by Video ID if available
  const sampleVideoId = 'LF55pVitnxY';
  console.log(`\nTesting comment fetching for Video ID: ${sampleVideoId}...`);
  try {
    const videoComments = await fetchLatestComments(youtube, null, 20, sampleVideoId);
    console.log(`✓ [VIDEO COMMENTS SUCCESS] Fetched ${videoComments.length} comments for Video ID (${sampleVideoId})!`);
    videoComments.slice(0, 5).forEach((c, i) => {
      console.log(`  [Comment ${i + 1}] Author: "${c.author}", Text: "${c.text}"`);
    });
  } catch (err) {
    console.log(`⚠️ Video-level comment fetch notice: ${err.message}`);
  }

  // 3. Check connected channels in MongoDB
  const connectedChannels = await Channel.find({}).lean();
  console.log(`\n=== CONNECTED CHANNELS IN DATABASE: ${connectedChannels.length} ===`);
  connectedChannels.forEach((ch, idx) => {
    console.log(`  [${idx + 1}] Title: "${ch.title || ch.channelName}", ChannelID: ${ch.channelId}, ReconnectRequired: ${ch.reconnectRequired || false}`);
  });

  await mongoose.disconnect();
  console.log('\n=== TEST COMPLETED ===');
}

main().catch(console.error);
