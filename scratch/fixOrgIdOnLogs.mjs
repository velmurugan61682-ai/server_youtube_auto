import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const channelId = 'UCdpaYm53cdH0SODoBXAKRmQ';
  const techVaseegrahOrgId = '6a61e033f3e45a716947e418';

  // Find who created the moderation logs
  const user = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId('6a62083b195f9340e0aa5df8') });
  console.log('User who created logs:', user?.email, '| org:', user?.organizationId);

  // Get count by channelId only (ignore userId/orgId)
  const autoReplyByChannel = await db.collection('autoreplylogs').countDocuments({ channelId });
  const modByChannel = await db.collection('moderationlogs').countDocuments({ channelId });
  console.log('\nData by channelId alone:');
  console.log('AutoReplyLogs by channelId:', autoReplyByChannel);
  console.log('ModerationLogs by channelId:', modByChannel);

  // Update all logs with channelId to have correct organizationId
  console.log('\nFixing organizationId on all logs for Tech Vaseegrah channel...');
  const correctOrgId = new mongoose.Types.ObjectId(techVaseegrahOrgId);

  const r1 = await db.collection('autoreplylogs').updateMany(
    { channelId, $or: [{ organizationId: { $exists: false } }, { organizationId: null }] },
    { $set: { organizationId: correctOrgId } }
  );
  console.log('AutoReplyLogs fixed (missing orgId):', r1.modifiedCount);

  const r2 = await db.collection('moderationlogs').updateMany(
    { channelId },
    { $set: { organizationId: correctOrgId } }
  );
  console.log('ModerationLogs fixed (all set to Tech Vaseegrah orgId):', r2.modifiedCount);

  const r3 = await db.collection('comments').updateMany(
    { channelId, $or: [{ organizationId: { $exists: false } }, { organizationId: null }] },
    { $set: { organizationId: correctOrgId } }
  );
  console.log('Comments fixed (missing orgId):', r3.modifiedCount);

  const r4 = await db.collection('autoreplylogs').updateMany(
    { channelId },
    { $set: { organizationId: correctOrgId } }
  );
  console.log('AutoReplyLogs fixed (all set to Tech Vaseegrah orgId):', r4.modifiedCount);

  process.exit(0);
};

run().catch(e => { console.error(e); process.exit(1); });
