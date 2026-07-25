import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AutoLikeLog from '../models/AutoLikeLog.mjs';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.log('--- LATEST 5 AUTO LIKE LOGS ---');
  const logs = await AutoLikeLog.find({}).sort({ createdAt: -1 }).limit(5).lean();
  
  logs.forEach((l, i) => {
    console.log(`\nLog ${i + 1}:`);
    console.log(`  ID: ${l._id}`);
    console.log(`  Comment ID: ${l.commentId}`);
    console.log(`  Status: ${l.status}`);
    console.log(`  Error: ${l.error || 'None'}`);
    console.log(`  Date: ${l.createdAt || l.timestamp}`);
  });
  
  process.exit(0);
}

run();
