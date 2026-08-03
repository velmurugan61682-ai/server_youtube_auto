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

    console.log('--- Test 1: mine: true, broadcastStatus: active ---');
    try {
      const res1 = await youtube.liveBroadcasts.list({
        part: 'snippet,status,contentDetails',
        mine: true,
        broadcastStatus: 'active'
      });
      console.log('Result 1 count:', res1.data.items?.length);
      console.log('Items 1:', res1.data.items?.map(i => ({ id: i.id, title: i.snippet?.title, status: i.status?.lifeCycleStatus })));
    } catch (e) {
      console.error('Error 1:', e.message);
    }

    console.log('\n--- Test 2: mine: true, broadcastStatus: all ---');
    try {
      const res2 = await youtube.liveBroadcasts.list({
        part: 'snippet,status,contentDetails',
        mine: true,
        broadcastStatus: 'all',
        maxResults: 5
      });
      console.log('Result 2 count:', res2.data.items?.length);
      console.log('Items 2:', res2.data.items?.map(i => ({ id: i.id, title: i.snippet?.title, status: i.status?.lifeCycleStatus })));
    } catch (e) {
      console.error('Error 2:', e.message);
    }

    console.log('\n--- Test 3: search.list eventType: live ---');
    try {
      const res3 = await youtube.search.list({
        part: 'snippet',
        channelId: channel.channelId,
        type: 'video',
        eventType: 'live'
      });
      console.log('Result 3 count:', res3.data.items?.length);
      console.log('Items 3:', res3.data.items?.map(i => ({ id: i.id?.videoId, title: i.snippet?.title })));
    } catch (e) {
      console.error('Error 3:', e.message);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
