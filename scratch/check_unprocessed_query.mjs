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
    
    // Find active channel
    const channel = await Channel.findOne({ channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' });
    console.log('Channel details:');
    console.log(` - _id: ${channel._id}`);
    console.log(` - userId: ${channel.userId}`);
    console.log(` - channelId: ${channel.channelId}`);

    const q = { 
      userId: channel.userId, 
      channelId: channel.channelId, 
      aiActionTaken: false,
      aiStatus: { $nin: ['processing', 'completed'] }
    };
    console.log('\nQuery being executed:', JSON.stringify(q, null, 2));

    const unprocessed = await Comment.find(q).sort({ publishedAt: -1 }).limit(10);
    console.log('Unprocessed comments found:', unprocessed.length);
    if (unprocessed.length > 0) {
      unprocessed.forEach(u => {
        console.log(` - ID: ${u.youtubeId}, Text: "${u.text}", aiStatus: ${u.aiStatus}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
