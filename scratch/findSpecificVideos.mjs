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

    const videos = await Video.find({
      $or: [
        { title: /Why wait/i },
        { title: /ஆர்டர் செய்ய/i },
        { title: /Behind the Build/i },
        { title: /Internships scenes/i }
      ]
    }).lean();

    console.log(`Found ${videos.length} videos matching the query:`);
    for (const v of videos) {
      console.log(`- Title: ${v.title}`);
      console.log(`  isPost: ${v.isPost} (type: ${typeof v.isPost})`);
      console.log(`  duration: ${v.duration}`);
      console.log(`  videoId: ${v.videoId}`);
      console.log('-------------------');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
