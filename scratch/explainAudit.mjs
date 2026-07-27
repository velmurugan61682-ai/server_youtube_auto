import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';

import Comment from '../models/Comment.mjs';
import Lead from '../models/Lead.mjs';
import Video from '../models/Video.mjs';
import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function runExplainAudit() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri, { family: 4 });
  console.log('✅ Connected to MongoDB\n');

  const dummyUserId = new mongoose.Types.ObjectId();

  // 1. Comment query (.explain)
  console.log('--- 1. Comment Query Explain ---');
  const commentQuery = Comment.find({
    userId: dummyUserId,
    isModerated: false
  }).sort({ createdAt: -1 });

  const commentExplain = await commentQuery.explain('executionStats');
  const commentStats = commentExplain.executionStats || {};
  const commentPlan = commentExplain.queryPlanner?.winningPlan || {};

  console.log('Comment Query Results:');
  console.log(' - executionTimeMillis:', commentStats.executionTimeMillis);
  console.log(' - totalDocsExamined:', commentStats.totalDocsExamined);
  console.log(' - totalKeysExamined:', commentStats.totalKeysExamined);
  console.log(' - nReturned:', commentStats.nReturned);
  console.log(' - stage:', commentPlan.stage || commentPlan.inputStage?.stage);
  console.log(' - indexName:', commentPlan.indexName || commentPlan.inputStage?.indexName || 'N/A');
  console.log('');

  // 2. Lead query (.explain)
  console.log('--- 2. Lead Query Explain ---');
  const leadQuery = Lead.find({
    userId: dummyUserId
  }).sort({ createdAt: -1 });

  const leadExplain = await leadQuery.explain('executionStats');
  const leadStats = leadExplain.executionStats || {};
  const leadPlan = leadExplain.queryPlanner?.winningPlan || {};

  console.log('Lead Query Results:');
  console.log(' - executionTimeMillis:', leadStats.executionTimeMillis);
  console.log(' - totalDocsExamined:', leadStats.totalDocsExamined);
  console.log(' - totalKeysExamined:', leadStats.totalKeysExamined);
  console.log(' - nReturned:', leadStats.nReturned);
  console.log(' - stage:', leadPlan.stage || leadPlan.inputStage?.stage);
  console.log(' - indexName:', leadPlan.indexName || leadPlan.inputStage?.indexName || 'N/A');
  console.log('');

  // 3. Video query (.explain)
  console.log('--- 3. Video Query Explain ---');
  const videoQuery = Video.find({
    userId: dummyUserId,
    channelId: 'UC_dummy_channel_id'
  }).sort({ publishedAt: -1 });

  const videoExplain = await videoQuery.explain('executionStats');
  const videoStats = videoExplain.executionStats || {};
  const videoPlan = videoExplain.queryPlanner?.winningPlan || {};

  console.log('Video Query Results:');
  console.log(' - executionTimeMillis:', videoStats.executionTimeMillis);
  console.log(' - totalDocsExamined:', videoStats.totalDocsExamined);
  console.log(' - totalKeysExamined:', videoStats.totalKeysExamined);
  console.log(' - nReturned:', videoStats.nReturned);
  console.log(' - stage:', videoPlan.stage || videoPlan.inputStage?.stage);
  console.log(' - indexName:', videoPlan.indexName || videoPlan.inputStage?.indexName || 'N/A');
  console.log('');

  // 4. Dashboard Toxic Comment Count Query Explain
  console.log('--- 4. Dashboard Toxic Comment Count Query Explain ---');
  const toxicQuery = Comment.find({
    userId: dummyUserId,
    sentiment: 'toxic'
  });
  const toxicExplain = await toxicQuery.explain('executionStats');
  const toxicStats = toxicExplain.executionStats || {};
  const toxicPlan = toxicExplain.queryPlanner?.winningPlan || {};

  console.log('Toxic Comment Query Results:');
  console.log(' - executionTimeMillis:', toxicStats.executionTimeMillis);
  console.log(' - totalDocsExamined:', toxicStats.totalDocsExamined);
  console.log(' - totalKeysExamined:', toxicStats.totalKeysExamined);
  console.log(' - stage:', toxicPlan.stage || toxicPlan.inputStage?.stage);
  console.log(' - indexName:', toxicPlan.indexName || toxicPlan.inputStage?.indexName || 'N/A');
  console.log('');

  await mongoose.disconnect();
  console.log('Audit complete.');
  process.exit(0);
}

runExplainAudit().catch(err => {
  console.error('Audit Error:', err);
  process.exit(1);
});
