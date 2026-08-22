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

  const channels = await Channel.find({}).lean();
  console.log('Channels:');
  for (const ch of channels) {
    console.log(`- _id: ${ch._id}, channelId: ${ch.channelId}, title: ${ch.title}, userId: ${ch.userId}, orgId: ${ch.organizationId}, apiKey: ${ch.apiKey ? 'YES' : 'NO'}, hasTokens: ${ch.accessToken ? 'YES' : 'NO'}`);
  }

  console.log('\nComment status distribution:');
  const statusCounts = await Comment.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  console.log(statusCounts);

  console.log('\nSample 5 comments:');
  const sampleComments = await Comment.find({}).limit(5).lean();
  console.log(sampleComments.map(c => ({
    _id: c._id,
    youtubeId: c.youtubeId,
    channelId: c.channelId,
    status: c.status,
    userId: c.userId,
    organizationId: c.organizationId,
    text: c.text
  })));

  const AutomationLog = mongoose.model('AutomationLog', new mongoose.Schema({}, { strict: false }));
  const autoLogs = await AutomationLog.find({}).sort({ createdAt: -1 }).limit(10).lean();
  console.log('\nRecent AutomationLogs:', autoLogs);

  await mongoose.disconnect();
}

check().catch(console.error);
