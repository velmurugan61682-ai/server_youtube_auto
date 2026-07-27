import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';

import Video from '../models/Video.mjs';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function inspectVideos() {
  console.log('Connecting to MongoDB to inspect Video documents...');
  await mongoose.connect(uri, { family: 4 });
  console.log('✅ Connected to MongoDB\n');

  const allVideos = await Video.find({}).lean();
  console.log(`Total Video records in DB: ${allVideos.length}`);

  for (const v of allVideos) {
    console.log(`- ID: ${v._id} | videoId: ${v.videoId} | isPost: ${v.isPost} | title: "${v.title}" | channelId: ${v.channelId}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

inspectVideos().catch(err => {
  console.error('Inspect Error:', err);
  process.exit(1);
});
