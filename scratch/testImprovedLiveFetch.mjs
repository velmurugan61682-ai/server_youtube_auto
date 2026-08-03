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

    let videoIds = [];

    // Step 1: try broadcastStatus: 'active'
    try {
      const res = await youtube.liveBroadcasts.list({
        part: 'snippet,status,contentDetails',
        broadcastStatus: 'active',
        maxResults: 10
      });
      if (res.data.items?.length > 0) {
        videoIds = res.data.items.map(i => i.id);
        console.log('Found via broadcastStatus active:', videoIds);
      }
    } catch (e) {
      console.warn('broadcastStatus active error:', e.message);
    }

    // Step 2: if empty, try mine: true and filter lifeCycleStatus === 'live' or 'testing'
    if (videoIds.length === 0) {
      try {
        const mineRes = await youtube.liveBroadcasts.list({
          part: 'snippet,status,contentDetails',
          mine: true,
          maxResults: 10
        });
        const activeItems = (mineRes.data.items || []).filter(i => 
          i.status?.lifeCycleStatus === 'live' || 
          i.status?.lifeCycleStatus === 'testing' ||
          i.snippet?.liveBroadcastContent === 'live'
        );
        videoIds = activeItems.map(i => i.id);
        console.log('Found via mine: true active filter:', videoIds);
      } catch (e) {
        console.warn('mine: true error:', e.message);
      }
    }

    console.log('Final Video IDs detected:', videoIds);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
