import mongoose from 'mongoose';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { decrypt } from '../utils/cryptoHelper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ChannelSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  channelId: String,
  title: String,
  accessToken: String,
  refreshToken: String,
  expiryDate: Number
});
const Channel = mongoose.model('Channel', ChannelSchema);

const run = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);

    const channel = await Channel.findOne({ userId: '6a3a6ffbb0dc909c45933e35', channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' });
    const decryptedAccessToken = decrypt(channel.accessToken);
    const decryptedRefreshToken = channel.refreshToken ? decrypt(channel.refreshToken) : undefined;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:5000/api/youtube/callback'
    );
    oauth2Client.setCredentials({
      access_token: decryptedAccessToken,
      refresh_token: decryptedRefreshToken,
      expiry_date: channel.expiryDate
    });

    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });

    // Check multiple video IDs
    const videoIds = ['5vBY8Jj5Wds', 'gQ-vzAPEwRU', 'CP1rmse6Keg', 'nf8ZUsgufd4', 'TC3NFvt9uZ0'];
    console.log(`Checking live status for videos: ${videoIds.join(', ')}`);

    const res = await youtube.videos.list({
      part: 'snippet,status',
      id: videoIds.join(',')
    });

    console.log(`Found ${res.data.items?.length || 0} active videos on YouTube.`);
    res.data.items?.forEach((item) => {
      console.log(`- Title: "${item.snippet.title}" | VideoID: ${item.id} | Status: ${item.status.privacyStatus}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
  }
};

run();
