import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import Organization from '../models/Organization.mjs';

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const channels = await Channel.find({}).lean();
    console.log(`\n=== ALL CHANNELS (${channels.length}) ===`);
    for (const c of channels) {
      console.log(`ChannelId: ${c.channelId} | Title: '${c.title}' | UserId: ${c.userId} | OrgId: ${c.organizationId}`);
    }

    const users = await User.find({}).lean();
    console.log(`\n=== ALL USERS (${users.length}) ===`);
    for (const u of users) {
      const uOrg = u.organizationId ? await Organization.findById(u.organizationId).lean() : null;
      console.log(`User: '${u.email}' | Role: ${u.role} | OrgId: ${u.organizationId} (${uOrg?.name || 'No Org'})`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
