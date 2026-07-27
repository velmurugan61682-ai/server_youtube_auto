import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';

import Channel from '../models/Channel.mjs';
import { scrapeCommunityPosts } from '../services/youtubeService.mjs';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function testScrape() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri, { family: 4 });
  console.log('✅ Connected to MongoDB\n');

  const channels = await Channel.find({}).lean();
  console.log(`Found ${channels.length} connected channels in DB.\n`);

  for (const ch of channels) {
    console.log(`--- Scraping for Channel: ${ch.title} (${ch.channelId}) | customUrl: ${ch.customUrl} ---`);
    const posts = await scrapeCommunityPosts(ch.customUrl, ch.channelId);
    console.log(`Result: ${posts.length} posts scraped.`);
    posts.forEach((p, idx) => {
      console.log(`  [Post ${idx + 1}] ID: ${p.postId} | Text: "${p.text.substring(0, 60)}..."`);
    });
    console.log('');
  }

  await mongoose.disconnect();
  process.exit(0);
}

testScrape().catch(err => {
  console.error('Test Scrape Error:', err);
  process.exit(1);
});
