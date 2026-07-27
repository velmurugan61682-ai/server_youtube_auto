import '../config/env.mjs';
import mongoose from 'mongoose';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import Organization from '../models/Organization.mjs';

async function checkUsers() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find().lean();
  console.log('--- USERS IN DATABASE ---');
  users.forEach(u => {
    console.log(`- Email: ${u.email} | Name: ${u.name} | Role: ${u.role} | OrgId: ${u.organizationId}`);
  });

  const channels = await Channel.find().lean();
  console.log('\n--- CHANNELS IN DATABASE ---');
  channels.forEach(c => {
    console.log(`- Title: ${c.title} | ChannelId: ${c.channelId} | UserId: ${c.userId}`);
  });

  await mongoose.disconnect();
}

checkUsers().catch(console.error);
