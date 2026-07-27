import '../config/env.mjs';
import mongoose from 'mongoose';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({}).lean();
  console.log('All Users:');
  for (const u of users) {
    const channelCount = await Channel.countDocuments({ userId: u._id });
    const commentCount = await Comment.countDocuments({ userId: u._id });
    console.log(` - ID: ${u._id}, Email: ${u.email}, Name: ${u.name}, Role: ${u.role}, OrgId: ${u.organizationId}, Channels: ${channelCount}, Comments: ${commentCount}`);
  }
  process.exit(0);
}

check();
