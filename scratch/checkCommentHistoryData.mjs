import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const orgId = new mongoose.Types.ObjectId('6a61e033f3e45a716947e418');
  const channelId = 'UCdpaYm53cdH0SODoBXAKRmQ';

  const orgFilter = { $or: [{ organizationId: orgId }, { channelId }] };

  const autoReplyLogs = await db.collection('autoreplylogs').countDocuments(orgFilter);
  const moderationLogs = await db.collection('moderationlogs').countDocuments(orgFilter);
  const comments = await db.collection('comments').countDocuments({ channelId });
  const autoReplyRules = await db.collection('autoreplyrules').countDocuments({ $or: [{ organizationId: orgId }, { channelId }] });
  const leads = await db.collection('leads').countDocuments(orgFilter);

  console.log('=== Tech Vaseegrah DB Data ===');
  console.log('AutoReplyLogs:', autoReplyLogs);
  console.log('ModerationLogs:', moderationLogs);
  console.log('Comments:', comments);
  console.log('AutoReplyRules:', autoReplyRules);
  console.log('Leads:', leads);

  // Sample some moderation logs to see their field structure
  const sampleMod = await db.collection('moderationlogs').find(orgFilter).limit(2).toArray();
  console.log('\nSample ModerationLog docs:');
  sampleMod.forEach(m => {
    console.log(' - userId:', m.userId, '| orgId:', m.organizationId, '| channelId:', m.channelId, '| action:', m.action || m.executedAction, '| status:', m.status);
  });

  const sampleReply = await db.collection('autoreplylogs').find(orgFilter).limit(2).toArray();
  console.log('\nSample AutoReplyLog docs:');
  sampleReply.forEach(r => {
    console.log(' - userId:', r.userId, '| orgId:', r.organizationId, '| channelId:', r.channelId, '| status:', r.status);
  });

  process.exit(0);
};

run().catch(e => { console.error(e); process.exit(1); });
