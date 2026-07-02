import '../config/env.mjs';
import mongoose from 'mongoose';
import Channel from '../models/Channel.mjs';

async function inspect() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');
    const channels = await Channel.find();
    console.log(`Total channels found: ${channels.length}`);
    for (const c of channels) {
      console.log({
        channelId: c.channelId,
        title: c.title,
        hasAccessToken: !!c.accessToken,
        accessTokenLen: c.accessToken?.length,
        hasRefreshToken: !!c.refreshToken,
        hasApiKey: !!c.apiKey,
        apiKeyLen: c.apiKey?.length
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

inspect();
