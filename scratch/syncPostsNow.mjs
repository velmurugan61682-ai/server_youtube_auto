import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';

import Channel from '../models/Channel.mjs';
import Video from '../models/Video.mjs';
import { scrapeCommunityPosts } from '../services/youtubeService.mjs';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function syncNow() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri, { family: 4 });
  console.log('✅ Connected to MongoDB\n');

  const channel = await Channel.findOne({ channelId: 'UCdpaYm53cdH0SODoBXAKRmQ' }).lean();
  if (!channel) {
    console.log('Channel UCdpaYm53cdH0SODoBXAKRmQ not found in DB');
    process.exit(1);
  }

  console.log(`Syncing posts for: ${channel.title} (${channel.channelId})...`);
  const scraped = await scrapeCommunityPosts(channel.customUrl, channel.channelId);
  console.log(`Scraped ${scraped.length} posts from YouTube.`);

  for (let i = 0; i < scraped.length; i++) {
    const p = scraped[i];
    const postId = p.postId || `yt_post_${channel.channelId}_${i}`;
    await Video.findOneAndUpdate(
      { channelId: channel.channelId, videoId: postId },
      {
        $set: {
          userId: channel.userId,
          channelId: channel.channelId,
          videoId: postId,
          title: (p.text || '').split('\n')[0] || 'Community Post',
          description: p.text,
          thumbnail: p.thumbnail || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=150',
          isPost: true,
          analyzed: true,
          statistics: { viewCount: 0, likeCount: 0, commentCount: 0 },
          lastFetchedAt: new Date()
        },
        $setOnInsert: {
          publishedAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
  }

  const postsInDb = await Video.find({ channelId: channel.channelId, isPost: true }).lean();
  console.log(`✅ Success! ${postsInDb.length} community posts saved in DB:`);
  postsInDb.forEach((p, idx) => {
    console.log(`  [Post ${idx + 1}] ID: ${p.videoId} | title: "${p.title}"`);
  });

  await mongoose.disconnect();
  process.exit(0);
}

syncNow().catch(console.error);
