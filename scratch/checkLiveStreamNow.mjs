import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Channel from '../models/Channel.mjs';
import Video from '../models/Video.mjs';
import { getYouTubeClient, getYouTubeClientWithApiKey, fetchChannelLiveStreams } from '../services/youtubeService.mjs';
import { decrypt } from '../utils/cryptoHelper.mjs';

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const channel = await Channel.findOne({ channelId: 'UCdpaYm53cdH0SODoBXAKRmQ' });
    if (!channel) {
      console.log('Channel not found');
      process.exit(1);
    }

    console.log('Channel Title:', channel.title);
    console.log('Channel Auth Method:', channel.apiKey ? 'API Key' : 'OAuth Tokens');
    console.log('Has AccessToken:', Boolean(channel.accessToken));
    console.log('Has RefreshToken:', Boolean(channel.refreshToken));

    let youtube;
    if (channel.apiKey) {
      youtube = getYouTubeClientWithApiKey(decrypt(channel.apiKey));
    } else {
      const tokens = {
        access_token: decrypt(channel.accessToken),
        refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
        expiry_date: channel.expiryDate
      };
      youtube = getYouTubeClient(tokens, null, channel._id);
    }

    console.log('\nFetching live streams via fetchChannelLiveStreams()...');
    const streams = await fetchChannelLiveStreams(youtube, channel.channelId);
    console.log('Streams found from YouTube API:', streams);

    console.log('\nChecking Videos collection in DB for live streams...');
    const dbLiveVideos = await Video.find({
      channelId: channel.channelId,
      $or: [
        { isLive: true },
        { liveBroadcastContent: { $in: ['live', 'completed', 'upcoming'] } },
        { title: { $regex: /^LIVE\s*\||LIVE STREAM|WAS LIVE/i } }
      ]
    }).sort({ publishedAt: -1 }).lean();
    console.log('DB Live Videos found:', dbLiveVideos.length);
    dbLiveVideos.forEach(v => {
      console.log(` - Video: ${v.title} (${v.videoId}) | isLive: ${v.isLive} | content: ${v.liveBroadcastContent} | liveChatId: ${v.liveChatId}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

run();
