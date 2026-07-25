import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Comment from '../models/Comment.mjs';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.log('--- UNREPLIED SAFE COMMENTS ---');
  const comments = await Comment.find({
    status: 'approved',
    hasReplied: { $ne: true },
    isBotReply: { $ne: true }
  }).lean();
  
  console.log(`Count: ${comments.length}`);
  comments.forEach((c, i) => {
    console.log(`\nComment ${i+1}:`);
    console.log(`  ID: ${c.youtubeId}`);
    console.log(`  Author: ${c.author}`);
    console.log(`  Text: "${c.text}"`);
    console.log(`  Sentiment: ${c.sentiment}`);
    console.log(`  Classification: ${c.classification}`);
    console.log(`  hasReplied: ${c.hasReplied}`);
    console.log(`  PublishedAt: ${c.publishedAt}`);
  });
  
  process.exit(0);
}

run();
