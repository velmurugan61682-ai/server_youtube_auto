import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.log('--- ALL USERS ---');
  const users = await User.find({}).lean();
  users.forEach((u, i) => {
    console.log(`${i+1}. ID: ${u._id}, Email: ${u.email}, Role: ${u.role}, OrgId: ${u.organizationId}`);
  });
  
  console.log('\n--- ALL CHANNELS ---');
  const channels = await Channel.find({}).lean();
  channels.forEach((c, i) => {
    console.log(`${i+1}. ID: ${c._id}, Title: ${c.title}, ChannelId: ${c.channelId}, UserId: ${c.userId}, OrgId: ${c.organizationId}`);
  });
  
  process.exit(0);
}

run();
