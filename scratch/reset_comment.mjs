import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Comment from '../models/Comment.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Find a comment for our user
    const comment = await Comment.findOne({ userId: '6a3a6ffbb0dc909c45933e35' });
    if (!comment) {
      console.log('No comment found to reset.');
      process.exit(1);
    }

    console.log(`Resetting comment ${comment.youtubeId} ("${comment.text}") to pending...`);
    comment.aiActionTaken = false;
    comment.aiStatus = 'pending';
    comment.replyStatus = 'none';
    comment.replyText = undefined;
    await comment.save();
    
    console.log('Reset complete!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
