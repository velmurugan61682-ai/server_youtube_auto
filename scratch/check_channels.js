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
  title: String
});
const Channel = mongoose.model('Channel', ChannelSchema);

const run = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const channels = await Channel.find();
    channels.forEach((c) => {
      console.log(`Title: "${c.title}" | ChannelID: ${c.channelId} | UserID: ${c.userId}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
};

run();
