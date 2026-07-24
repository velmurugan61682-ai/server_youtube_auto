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
    
    const countTotal = await Video.countDocuments({ channelId });
    const countWithDuration = await Video.countDocuments({ channelId, duration: { $exists: true, $ne: null } });
    const countEmptyDuration = await Video.countDocuments({ channelId, $or: [{ duration: null }, { duration: '' }] });

    console.log(`Total videos: ${countTotal}`);
    console.log(`With duration: ${countWithDuration}`);
    console.log(`Without/Empty duration: ${countEmptyDuration}`);

    // Print some without duration
    const sampleNoDuration = await Video.find({ channelId, $or: [{ duration: null }, { duration: '' }] }).limit(10).lean();
    console.log('\nSample without duration:');
    for (const v of sampleNoDuration) {
      console.log(`- Title: ${v.title} | isPost: ${v.isPost}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
