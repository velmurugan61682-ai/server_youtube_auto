import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Channel from '../models/Channel.mjs';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const channels = await Channel.find({});
  console.log(`Total Channels: ${channels.length}`);
  channels.forEach((c, idx) => {
    console.log(`\nChannel ${idx + 1}:`);
    console.log(`  Title: "${c.title}"`);
    console.log(`  ChannelId: "${c.channelId}"`);
    console.log(`  UserId: "${c.userId}"`);
    console.log(`  OrganizationId: "${c.organizationId}"`);
  });
  
  process.exit(0);
}

run();
