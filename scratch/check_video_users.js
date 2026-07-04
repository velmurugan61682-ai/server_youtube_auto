import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const VideoSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  channelId: String,
  videoId: String,
  title: String
});
const Video = mongoose.model('Video', VideoSchema);

const run = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);
    console.log('Connected.');

    const videos = await Video.find({ channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' });
    videos.forEach((v) => {
      console.log(`Title: "${v.title}" | VideoID: ${v.videoId} | UserID: ${v.userId}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

run();
