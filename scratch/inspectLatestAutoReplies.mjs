import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AutoReplyLog from '../models/AutoReplyLog.mjs';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.log('--- LATEST 5 AUTO REPLY LOGS ---');
  const logs = await AutoReplyLog.find({}).sort({ createdAt: -1 }).limit(5).lean();
  
  logs.forEach((l, i) => {
    console.log(`\nLog ${i + 1}:`);
    console.log(`  ID: ${l._id}`);
    console.log(`  Comment ID: ${l.commentId}`);
    console.log(`  Trigger: "${l.triggerKeyword}"`);
    console.log(`  Comment Text: "${l.commentText}"`);
    console.log(`  Reply Text: "${l.replyText}"`);
    console.log(`  Status: ${l.status}`);
    console.log(`  Failure Reason: ${l.failureReason || 'None'}`);
    console.log(`  Date: ${l.createdAt || l.timestamp}`);
  });
  
  process.exit(0);
}

run();
