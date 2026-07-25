import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';
import Comment from '../models/Comment.mjs';
import Video from '../models/Video.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import Lead from '../models/Lead.mjs';

async function assignToTech() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const techUser = await User.findOne({ email: 'tech@gmail.com' });
    if (!techUser) {
      console.log('tech@gmail.com not found');
      process.exit(1);
    }

    const userId = techUser._id;
    console.log('Assigning channel UCyFw6NotahbWYQnWfWc7Wmw to tech user ID:', userId);

    // Deduplicate videos for this channel and user
    const channelVideos = await Video.find({ channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' }).lean();
    const videoIds = channelVideos.map(v => v.videoId);

    await Video.deleteMany({ userId, videoId: { $in: videoIds } });

    const channelRes = await Channel.updateMany(
      { channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' },
      { $set: { userId } }
    );
    const commentRes = await Comment.updateMany(
      { channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' },
      { $set: { userId } }
    );
    const videoRes = await Video.updateMany(
      { channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' },
      { $set: { userId } }
    );
    const modRes = await ModerationLog.updateMany(
      { channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' },
      { $set: { userId } }
    );
    const replyRes = await AutoReplyLog.updateMany(
      { channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' },
      { $set: { userId } }
    );
    const leadRes = await Lead.updateMany(
      { channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' },
      { $set: { userId } }
    );

    console.log(`✅ SUCCESS! Channel assigned to tech@gmail.com (${userId}): modified channels ${channelRes.modifiedCount}, comments ${commentRes.modifiedCount}, videos ${videoRes.modifiedCount}`);
    process.exit(0);
  } catch (err) {
    console.error('Error assigning to tech:', err);
    process.exit(1);
  }
}

assignToTech();
