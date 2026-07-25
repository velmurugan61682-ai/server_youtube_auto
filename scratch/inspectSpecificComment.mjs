import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Comment from '../models/Comment.mjs';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const c = await Comment.findOne({ youtubeId: 'Ugz3-rj7-sFti391F514AaABAg' }).lean();
  console.log('--- SPECIFIC COMMENT DETAILS ---');
  console.log(JSON.stringify(c, null, 2));
  
  process.exit(0);
}

run();
