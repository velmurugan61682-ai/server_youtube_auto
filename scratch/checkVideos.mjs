import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Video from '../models/Video.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to Database');

    const total = await Video.countDocuments({});
    console.log('Total videos in DB:', total);

    const samples = await Video.find({}).limit(30).lean();
    console.log('\n--- Video Samples ---');
    for (const v of samples) {
      console.log(`- Title: ${v.title}`);
      console.log(`  videoId: ${v.videoId}`);
      console.log(`  isPost: ${v.isPost} (type: ${typeof v.isPost})`);
      console.log(`  duration: ${v.duration}`);
      console.log(`  publishedAt: ${v.publishedAt}`);
      console.log('-------------------');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
