import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import ModerationLog from '../models/ModerationLog.mjs';
import Comment from '../models/Comment.mjs';
import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
  console.log('Connected to DB name:', mongoose.connection.name);

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  const modCount = await ModerationLog.countDocuments({});
  const commentCount = await Comment.countDocuments({});
  const channelCount = await Channel.countDocuments({});
  console.log({ modCount, commentCount, channelCount });

  console.log('\n--- Most Recent 5 ModerationLog documents ---');
  const recentLogs = await ModerationLog.find({}).sort({ createdAt: -1 }).limit(5).lean();
  console.log(JSON.stringify(recentLogs, null, 2));

  console.log('\n--- Most Recent 5 ModerationLog documents with executedAction or action matching delete ---');
  const recentDeletedLogs = await ModerationLog.find({
    $or: [
      { executedAction: /delete/i },
      { action: /delete/i }
    ]
  }).sort({ createdAt: -1 }).limit(5).lean();
  console.log(JSON.stringify(recentDeletedLogs, null, 2));

  console.log('\n--- Most Recent 5 Deleted Comments (Comment.status = deleted) ---');
  const recentDeletedComments = await Comment.find({ status: 'deleted' }).sort({ updatedAt: -1 }).limit(5).lean();
  console.log(JSON.stringify(recentDeletedComments, null, 2));

  await mongoose.disconnect();
}

check().catch(console.error);
