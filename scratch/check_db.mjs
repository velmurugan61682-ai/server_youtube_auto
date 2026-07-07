import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Channel from '../models/Channel.mjs';
import Video from '../models/Video.mjs';
import User from '../models/User.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected');
    
    const users = await User.find({});
    console.log(`Total Users: ${users.length}`);
    for (const u of users) {
      const channels = await Channel.find({ userId: u._id });
      console.log(`User: ${u.email} (ID: ${u._id})`);
      console.log(`  - Channels (${channels.length}):`);
      for (const c of channels) {
        const videoCount = await Video.countDocuments({ userId: u._id, channelId: c.channelId });
        console.log(`    * Title: "${c.title}" (channelId: "${c.channelId}") - Videos in DB: ${videoCount}`);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

test();
