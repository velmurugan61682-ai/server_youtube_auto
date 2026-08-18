import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import Video from '../models/Video.mjs';

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const channelId = 'UCdpaYm53cdH0SODoBXAKRmQ';
    const videoId = 'H10Ptc0jqGA';

    const users = await User.find({}).lean();
    console.log(`Found ${users.length} users in DB:`);
    for (const u of users) {
      console.log(`- User: ${u.email} (id: ${u._id}, role: ${u.role}, org: ${u.organizationId})`);
    }

    const channel = await Channel.findOne({ channelId }).lean();
    console.log(`\nTarget Channel '${channelId}':`, channel ? { title: channel.title, userId: channel.userId, organizationId: channel.organizationId } : 'NOT FOUND');

    const video = await Video.findOne({ videoId }).lean();
    console.log(`Target Video '${videoId}':`, video ? { title: video.title, channelId: video.channelId } : 'NOT FOUND');

    await mongoose.disconnect();
    console.log('Audit completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Audit Error:', err);
    process.exit(1);
  }
};

run();
