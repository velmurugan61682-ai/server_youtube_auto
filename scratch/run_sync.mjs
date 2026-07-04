import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Channel from '../models/Channel.mjs';
import { processComments } from '../services/commentProcessingService.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const channel = await Channel.findOne({ channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' });
    if (!channel) {
      console.log('Channel not found');
      process.exit(1);
    }

    channel.lastSyncedAt = null;
    await channel.save();

    console.log('Running processComments...');
    // We pass a mock io object to capture any events or errors
    const mockIo = {
      to: (room) => {
        console.log(`[Socket Mock] to room: ${room}`);
        return {
          emit: (event, data) => {
            console.log(`[Socket Mock] emit event: ${event}`);
          }
        };
      }
    };

    await processComments(channel, null, null, mockIo);
    console.log('processComments completed.');
    process.exit(0);
  } catch (err) {
    console.error('Error running processComments:', err);
    process.exit(1);
  }
}

run();
