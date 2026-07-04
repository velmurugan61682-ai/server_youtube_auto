import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Comment from '../models/Comment.mjs';
import Channel from '../models/Channel.mjs';
import Video from '../models/Video.mjs';
import AutoDmConfig from '../models/AutoDmConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  console.log('Connecting to:', process.env.MONGODB_URI);
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');

    const commentCount = await Comment.countDocuments();
    console.log('Total comments in DB:', commentCount);

    const pendingComments = await Comment.find({ aiActionTaken: false });
    console.log('Comments with aiActionTaken: false count:', pendingComments.length);
    if (pendingComments.length > 0) {
      console.log('First 5 pending comments:');
      pendingComments.slice(0, 5).forEach(c => {
        console.log(` - ID: ${c.youtubeId}, Text: "${c.text}", aiStatus: ${c.aiStatus}, aiActionTaken: ${c.aiActionTaken}`);
      });
    }

    const completedComments = await Comment.find({ aiActionTaken: true });
    console.log('Comments with aiActionTaken: true count:', completedComments.length);

    const channels = await Channel.find();
    console.log('Total channels:', channels.length);
    channels.forEach(ch => {
      console.log(` - Channel: ${ch.title}, ID: ${ch.channelId}, lastSyncedAt: ${ch.lastSyncedAt}`);
    });

    const videos = await Video.find();
    console.log('Total videos:', videos.length);
    videos.slice(0, 5).forEach(v => {
      console.log(` - Video: ${v.title}, ID: ${v.videoId}`);
    });

    const configs = await AutoDmConfig.find();
    console.log('Total Auto DM Configs:', configs.length);
    configs.forEach(cfg => {
      console.log(` - Config: videoId=${cfg.videoId}, enabled=${cfg.enabled}, keywords=${cfg.keywords}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
