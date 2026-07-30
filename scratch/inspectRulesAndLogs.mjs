import mongoose from 'mongoose';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { getAnalytics } from '../controllers/analyticsController.mjs';

// Load env variables
const serverDir = 'C:\\Users\\Administrator\\Youtube\\server_youtube_auto';
const envPath = path.join(serverDir, '.env');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const user = await User.findOne({ email: 'velmurugan61682@gmail.com' });
  if (!user) {
    console.log('User not found.');
    await mongoose.disconnect();
    return;
  }

  // Mock req and res objects
  const req = {
    user: { id: user._id.toString() },
    query: {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    }
  };

  const res = {
    json: (data) => {
      console.log('\n--- Analytics API Output ---');
      console.log({
        totalComments: data.totalComments,
        toxicDeleted: data.toxicDeleted,
        positiveLiked: data.positiveLiked,
        liveViewers: data.liveViewers,
        channelSummary: data.channelSummary
      });
    },
    status: (code) => {
      console.log('Status code:', code);
      return res;
    }
  };

  await getAnalytics(req, res);

  await mongoose.disconnect();
}

run().catch(console.error);
