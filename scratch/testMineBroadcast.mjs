import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Channel from '../models/Channel.mjs';
import { getYouTubeClient } from '../services/youtubeService.mjs';
import { decrypt } from '../utils/cryptoHelper.mjs';

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const channel = await Channel.findOne({ channelId: 'UCdpaYm53cdH0SODoBXAKRmQ' });
    const tokens = {
      access_token: decrypt(channel.accessToken),
      refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
      expiry_date: channel.expiryDate
    };
    const youtube = getYouTubeClient(tokens, null, channel._id);

    console.log('--- Test mine: true ---');
    try {
      const res = await youtube.liveBroadcasts.list({
        part: 'snippet,status,contentDetails',
        mine: true,
        maxResults: 10
      });
      console.log('Mine count:', res.data.items?.length);
      res.data.items?.forEach(i => {
        console.log(` - ID: ${i.id} | Title: ${i.snippet?.title} | Status: ${i.status?.lifeCycleStatus} | liveChatId: ${i.snippet?.liveChatId}`);
      });
    } catch (e) {
      console.error('Error mine:', e.message);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
