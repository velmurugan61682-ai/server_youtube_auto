import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ChannelSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  channelId: String,
  title: String,
  lastSyncedAt: Date,
  uploadsPlaylistId: String
});
const Channel = mongoose.model('Channel', ChannelSchema);

const run = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);
    console.log('Connected.');

    const channel = await Channel.findOne({ userId: '6a3a6ffbb0dc909c45933e35', channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' });
    console.log('Channel Document:', JSON.stringify(channel, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

run();
