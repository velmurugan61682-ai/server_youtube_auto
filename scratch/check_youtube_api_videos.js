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
  expiryDate: Number,
  uploadsPlaylistId: String
});
const Channel = mongoose.model('Channel', ChannelSchema);

const run = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const channel = await Channel.findOne({ userId: '6a3a6ffbb0dc909c45933e35', channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' });
    if (!channel) {
      console.error('Channel not found in DB!');
      await mongoose.disconnect();
      return;
    }

    const decryptedAccessToken = decrypt(channel.accessToken);
    const decryptedRefreshToken = channel.refreshToken ? decrypt(channel.refreshToken) : undefined;

    console.log('Decrypting tokens completed.');

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

    console.log(`Calling playlistItems.list for uploads playlist: ${channel.uploadsPlaylistId} using OAuth token...`);
    const res = await youtube.playlistItems.list({
      part: 'snippet,contentDetails',
      playlistId: channel.uploadsPlaylistId,
      maxResults: 50
    });

    console.log('Response status:', res.status);
    console.log('Total items found in YouTube playlist:', res.data.items?.length || 0);
    res.data.items?.forEach((item, index) => {
      console.log(`${index + 1}. Title: "${item.snippet.title}" | VideoID: ${item.contentDetails.videoId}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
  }
};

run();
