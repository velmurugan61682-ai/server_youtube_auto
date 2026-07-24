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

    const channelId = 'UCdpaYm53cdH0SODoBXAKRmQ';
    const userId = '6a61ab6013a05a496c6ec738';
    
    const videos = await Video.find({ userId, channelId }).select('title duration').lean();
    console.log(`Total videos found: ${videos.length}`);
    for (const v of videos) {
      console.log(`- Title: ${v.title.substring(0, 50)} | duration: ${JSON.stringify(v.duration)}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
