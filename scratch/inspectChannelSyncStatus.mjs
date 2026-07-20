import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Channel from '../models/Channel.mjs';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const channel = await Channel.findOne({ channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' }).lean();
    console.log('Channel details in MongoDB:');
    console.log(JSON.stringify(channel, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
