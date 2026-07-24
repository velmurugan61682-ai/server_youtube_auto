import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Comment from '../models/Comment.mjs';
import Lead from '../models/Lead.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import AutoLikeLog from '../models/AutoLikeLog.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to Database');

    const collections = [
      { name: 'Channel', model: Channel },
      { name: 'Comment', model: Comment },
      { name: 'Lead', model: Lead },
      { name: 'ModerationLog', model: ModerationLog },
      { name: 'AutoLikeLog', model: AutoLikeLog },
      { name: 'AutoReplyLog', model: AutoReplyLog }
    ];

    for (const col of collections) {
      console.log(`\n=== Collection: ${col.name} ===`);
      const total = await col.model.countDocuments({});
      console.log(`Total count: ${total}`);
      if (total > 0) {
        const byUser = await col.model.aggregate([
          { $group: { _id: '$userId', count: { $sum: 1 } } }
        ]);
        console.log('Grouped by userId:', byUser);

        const byChannel = await col.model.aggregate([
          { $group: { _id: '$channelId', count: { $sum: 1 } } }
        ]);
        console.log('Grouped by channelId:', byChannel);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
