import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Video from '../models/Video.mjs';
import Channel from '../models/Channel.mjs';
import { getYouTubeClientWithApiKey, getYouTubeClient, fetchVideoStatisticsBatch } from '../services/youtubeService.mjs';
import { decrypt } from '../utils/cryptoHelper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to Database');

    const channelId = 'UCdpaYm53cdH0SODoBXAKRmQ';
    const userId = '6a61ab6013a05a496c6ec738';

    const channel = await Channel.findOne({ userId, channelId }).lean();
    if (!channel) {
      console.error('Channel not found!');
      process.exit(1);
    }

    let youtube;
    if (channel.apiKey) {
      youtube = getYouTubeClientWithApiKey(decrypt(channel.apiKey));
      console.log('Using API Key client');
    } else {
      const decryptedTokens = {
        access_token: decrypt(channel.accessToken),
        refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
        expiry_date: channel.expiryDate
      };
      youtube = getYouTubeClient(decryptedTokens, null, channel._id);
      console.log('Using OAuth client');
    }

    const videosWithoutDuration = await Video.find({
      userId,
      channelId,
      $or: [{ duration: null }, { duration: '' }]
    }).limit(10).lean();

    const videoIds = videosWithoutDuration.map(v => v.videoId);
    console.log(`Querying YouTube API for ${videoIds.length} videos:`, videoIds);

    const items = await fetchVideoStatisticsBatch(youtube, videoIds);
    console.log(`YouTube API returned ${items.length} items`);

    for (const item of items) {
      console.log(`- ID: ${item.id} | duration: ${item.contentDetails?.duration} | views: ${item.statistics?.viewCount}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
