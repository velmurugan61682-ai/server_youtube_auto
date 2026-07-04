import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const VideoSchema = new mongoose.Schema({
  channelId: String,
  videoId: String,
  title: String
});
const Video = mongoose.model('Video', VideoSchema);

const run = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    console.log('Connecting to URI:', uri ? 'Loaded' : 'Missing');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const count = await Video.countDocuments();
    console.log('Total videos in DB:', count);

    const videos = await Video.find();
    videos.forEach((v, index) => {
      console.log(`${index + 1}. Title: "${v.title}" | VideoID: ${v.videoId} | ChannelID: ${v.channelId}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
};

run();
