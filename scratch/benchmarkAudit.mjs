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

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function runScaleBenchmark() {
  console.log('Connecting to MongoDB for Scale Benchmark...');
  await mongoose.connect(uri, { family: 4 });
  console.log('✅ Connected to MongoDB\n');

  const benchmarkUserId = new mongoose.Types.ObjectId();
  const benchmarkOrgId = new mongoose.Types.ObjectId();
  const benchmarkChannelId = 'UC_benchmark_scale_channel';

  console.log(`Seeding 50,000 Comments for benchmarkUserId: ${benchmarkUserId}...`);
  const commentBatch = [];
  const now = Date.now();
  for (let i = 0; i < 50000; i++) {
    commentBatch.push({
      userId: benchmarkUserId,
      organizationId: benchmarkOrgId,
      youtubeId: `yt_scale_comment_${i}_${now}`,
      commentId: `yt_scale_comment_${i}_${now}`,
      channelId: benchmarkChannelId,
      videoId: `video_${i % 100}`,
      text: `Scale benchmark comment content iteration ${i}`,
      author: `User_${i}`,
      publishedAt: new Date(now - i * 1000),
      createdAt: new Date(now - i * 1000),
      sentiment: i % 10 === 0 ? 'toxic' : (i % 3 === 0 ? 'positive' : 'neutral'),
      status: 'pending',
      isModerated: false,
      autoLiked: i % 2 === 0
    });
  }
  await Comment.insertMany(commentBatch);
  console.log('✅ 50,000 Comments seeded.');

  console.log(`Seeding 50,000 Leads for benchmarkUserId: ${benchmarkUserId}...`);
  const leadBatch = [];
  for (let i = 0; i < 50000; i++) {
    leadBatch.push({
      userId: benchmarkUserId,
      organizationId: benchmarkOrgId,
      idempotencyKey: `lead_scale_key_${i}_${now}`,
      channelId: benchmarkChannelId,
      videoId: `video_${i % 100}`,
      commentId: `ext_lead_${i}_${now}`,
      authorName: `Lead_Author_${i}`,
      originalComment: `Interested in price details ${i}`,
      whatsappNumber: `+1555000${i.toString().padStart(4, '0')}`,
      status: i % 5 === 0 ? 'sent' : 'pending',
      createdAt: new Date(now - i * 1000)
    });
  }
  await Lead.insertMany(leadBatch);
  console.log('✅ 50,000 Leads seeded.');

  console.log(`Seeding 10,000 Videos for benchmarkUserId: ${benchmarkUserId}...`);
  const videoBatch = [];
  for (let i = 0; i < 10000; i++) {
    videoBatch.push({
      userId: benchmarkUserId,
      channelId: benchmarkChannelId,
      videoId: `scale_vid_${i}_${now}`,
      title: `Scale Video Title ${i}`,
      publishedAt: new Date(now - i * 3600000)
    });
  }
  await Video.insertMany(videoBatch);
  console.log('✅ 10,000 Videos seeded.\n');

  console.log('=====================================================');
  console.log('🔥 RUNNING EXPLAIN EXECUTIONSTATS ON 50k PRODUCTION-SCALE DATA');
  console.log('=====================================================\n');

  // 1. Comment Query Explain (Pagination limit: 50)
  console.log('--- 1. Comment Listing Query (50k docs in DB) ---');
  const commentStart = performance.now();
  const commentExplain = await Comment.find({
    userId: benchmarkUserId,
    isModerated: false
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .explain('executionStats');
  const commentTime = performance.now() - commentStart;
  const commentStats = commentExplain.executionStats || {};
  const commentPlan = commentExplain.queryPlanner?.winningPlan || {};

  console.log('Comment Query ExecutionStats:');
  console.log(' - executionTimeMillis:', commentStats.executionTimeMillis);
  console.log(' - totalDocsExamined:', commentStats.totalDocsExamined);
  console.log(' - totalKeysExamined:', commentStats.totalKeysExamined);
  console.log(' - nReturned:', commentStats.nReturned);
  console.log(' - Stage:', commentPlan.stage || commentPlan.inputStage?.stage);
  console.log(' - Index Name:', commentPlan.indexName || commentPlan.inputStage?.indexName || commentPlan.inputStage?.inputStage?.indexName || 'N/A');
  console.log(` - End-to-end driver timing: ${commentTime.toFixed(2)} ms\n`);

  // 2. Lead Query Explain (Pagination limit: 50)
  console.log('--- 2. Lead Listing Query (50k docs in DB) ---');
  const leadStart = performance.now();
  const leadExplain = await Lead.find({
    userId: benchmarkUserId
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .explain('executionStats');
  const leadTime = performance.now() - leadStart;
  const leadStats = leadExplain.executionStats || {};
  const leadPlan = leadExplain.queryPlanner?.winningPlan || {};

  console.log('Lead Query ExecutionStats:');
  console.log(' - executionTimeMillis:', leadStats.executionTimeMillis);
  console.log(' - totalDocsExamined:', leadStats.totalDocsExamined);
  console.log(' - totalKeysExamined:', leadStats.totalKeysExamined);
  console.log(' - nReturned:', leadStats.nReturned);
  console.log(' - Stage:', leadPlan.stage || leadPlan.inputStage?.stage);
  console.log(' - Index Name:', leadPlan.indexName || leadPlan.inputStage?.indexName || leadPlan.inputStage?.inputStage?.indexName || 'N/A');
  console.log(` - End-to-end driver timing: ${leadTime.toFixed(2)} ms\n`);

  // 3. Video Query Explain (Pagination limit: 50)
  console.log('--- 3. Video Listing Query (10k docs in DB) ---');
  const videoStart = performance.now();
  const videoExplain = await Video.find({
    userId: benchmarkUserId,
    channelId: benchmarkChannelId
  })
    .sort({ publishedAt: -1 })
    .limit(50)
    .explain('executionStats');
  const videoTime = performance.now() - videoStart;
  const videoStats = videoExplain.executionStats || {};
  const videoPlan = videoExplain.queryPlanner?.winningPlan || {};

  console.log('Video Query ExecutionStats:');
  console.log(' - executionTimeMillis:', videoStats.executionTimeMillis);
  console.log(' - totalDocsExamined:', videoStats.totalDocsExamined);
  console.log(' - totalKeysExamined:', videoStats.totalKeysExamined);
  console.log(' - nReturned:', videoStats.nReturned);
  console.log(' - Stage:', videoPlan.stage || videoPlan.inputStage?.stage);
  console.log(' - Index Name:', videoPlan.indexName || videoPlan.inputStage?.indexName || videoPlan.inputStage?.inputStage?.indexName || 'N/A');
  console.log(` - End-to-end driver timing: ${videoTime.toFixed(2)} ms\n`);

  // 4. Toxic Comment Count Query Explain
  console.log('--- 4. Dashboard Toxic Comment Count Query (50k docs in DB) ---');
  const toxicStart = performance.now();
  const toxicExplain = await Comment.find({
    userId: benchmarkUserId,
    sentiment: 'toxic'
  }).explain('executionStats');
  const toxicTime = performance.now() - toxicStart;
  const toxicStats = toxicExplain.executionStats || {};
  const toxicPlan = toxicExplain.queryPlanner?.winningPlan || {};

  console.log('Toxic Comment Count ExecutionStats:');
  console.log(' - executionTimeMillis:', toxicStats.executionTimeMillis);
  console.log(' - totalDocsExamined:', toxicStats.totalDocsExamined);
  console.log(' - totalKeysExamined:', toxicStats.totalKeysExamined);
  console.log(' - nReturned:', toxicStats.nReturned);
  console.log(' - Stage:', toxicPlan.stage || toxicPlan.inputStage?.stage);
  console.log(' - Index Name:', toxicPlan.indexName || toxicPlan.inputStage?.indexName || toxicPlan.inputStage?.inputStage?.indexName || 'N/A');
  console.log(` - End-to-end driver timing: ${toxicTime.toFixed(2)} ms\n`);

  // Cleanup benchmark test data
  console.log('🧹 Cleaning up 110,000 benchmark test records from MongoDB...');
  await Comment.deleteMany({ userId: benchmarkUserId });
  await Lead.deleteMany({ userId: benchmarkUserId });
  await Video.deleteMany({ userId: benchmarkUserId });
  console.log('✅ Cleanup complete.\n');

  await mongoose.disconnect();
  console.log('Benchmark script finished successfully.');
  process.exit(0);
}

runScaleBenchmark().catch(err => {
  console.error('Scale Benchmark Error:', err);
  process.exit(1);
});
