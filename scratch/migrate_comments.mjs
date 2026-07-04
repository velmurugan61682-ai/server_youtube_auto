import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Comment from '../models/Comment.mjs';
import Channel from '../models/Channel.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const channel = await Channel.findOne({ channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' });
    if (!channel) {
      console.log('Channel not found');
      process.exit(1);
    }
    
    console.log(`Migrating comments for channel ${channel.channelId} to userId ${channel.userId}...`);
    const res = await Comment.updateMany(
      { channelId: channel.channelId },
      { $set: { userId: channel.userId } }
    );
    console.log(`Updated ${res.modifiedCount} comments.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
