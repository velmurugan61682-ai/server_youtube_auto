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

async function reassign() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const targetUser = await User.findOne({ email: 'velmurugan61682@gmail.com' });
    if (!targetUser) {
      console.log('User velmurugan61682@gmail.com not found');
      process.exit(1);
    }

    const userId = targetUser._id;
    console.log('Target User ID:', userId);

    // Deduplicate videos for this channel
    const allVideos = await Video.find({ channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' }).lean();
    const seen = new Set();
    for (const v of allVideos) {
      if (seen.has(v.videoId)) {
        await Video.deleteOne({ _id: v._id });
        console.log(`Deleted duplicate video doc _id: ${v._id}, videoId: ${v.videoId}`);
      } else {
        seen.add(v.videoId);
      }
    }

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

    console.log(`✅ SUCCESS! Reassigned channel ${channelRes.modifiedCount}, comments ${commentRes.modifiedCount}, videos ${videoRes.modifiedCount}`);
    process.exit(0);
  } catch (err) {
    console.error('Error reassigning:', err);
    process.exit(1);
  }
}

reassign();
