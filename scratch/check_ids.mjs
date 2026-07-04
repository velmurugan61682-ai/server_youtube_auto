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
    const channel = await Channel.findOne();
    console.log('Channel details:');
    console.log(` - _id: ${channel._id}`);
    console.log(` - userId: ${channel.userId}`);
    console.log(` - channelId: ${channel.channelId}`);

    const sampleComments = await Comment.find({ aiActionTaken: false }).limit(5);
    console.log('\nSample pending comments:');
    sampleComments.forEach((c, index) => {
      console.log(`\nComment ${index + 1}:`);
      console.log(` - _id: ${c._id}`);
      console.log(` - userId: ${c.userId}`);
      console.log(` - channelId: ${c.channelId}`);
      console.log(` - videoId: ${c.videoId}`);
      console.log(` - text: "${c.text}"`);
      console.log(` - aiStatus: ${c.aiStatus}`);
      console.log(` - aiActionTaken: ${c.aiActionTaken}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
