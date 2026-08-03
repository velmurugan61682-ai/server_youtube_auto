import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Channel from '../models/Channel.mjs';
import { getYouTubeClient, fetchLiveChatMessages } from '../services/youtubeService.mjs';
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
    const liveChatId = 'Cg0KC1pOOEUyX3FEUXZzKicKGFVDZHBhWW01M2NkSDBTT0RvQlhBS1JtURILWk44RTJfcURRdnM';

    console.log(`Fetching live chat messages for liveChatId: ${liveChatId}...`);
    try {
      const messages = await fetchLiveChatMessages(youtube, liveChatId);
      console.log('Live chat messages fetched:', messages.length);
      console.log('Messages:', messages);
    } catch (err) {
      console.error('Error fetching live chat messages:', err.message);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
