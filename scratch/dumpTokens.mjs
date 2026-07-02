import '../config/env.mjs';
import mongoose from 'mongoose';
import Channel from '../models/Channel.mjs';

async function dump() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');
    const channels = await Channel.find();
    for (const c of channels) {
      console.log('--- Channel:', c.channelId || '(empty)', '---');
      console.log('accessToken:', c.accessToken);
      console.log('refreshToken:', c.refreshToken);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

dump();
