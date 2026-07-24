import '../config/env.mjs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getVideos } from '../controllers/youtubeController.mjs';
import Video from '../models/Video.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to Database');

    const channelId = 'UCdpaYm53cdH0SODoBXAKRmQ';
    const userId = '6a61ab6013a05a496c6ec738';

    // Mock request and response
    const req = {
      query: { channelId },
      user: {
        id: userId,
        organizationId: '6a58b3fca56b7151cdd2d250'
      }
    };

    const res = {
      json: async (data) => {
        console.log('SUCCESS!');
        // Let's inspect some video durations in the DB directly
        const samples = await Video.find({ userId, channelId }).limit(10).lean();
        console.log('Direct DB Check:');
        for (const v of samples) {
          console.log(`- Title: ${v.title} | duration: ${v.duration}`);
        }
        process.exit(0);
      },
      status: (code) => ({
        json: (data) => {
          console.error(`FAILED with status ${code}:`, data);
          process.exit(1);
        }
      })
    };

    console.log('Triggering getVideos controller...');
    await getVideos(req, res);

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
