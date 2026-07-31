import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('=== CHANNELS ===');
  const channels = await db.collection('channels').find({}).toArray();
  channels.forEach(c => {
    console.log(`ID: ${c._id} | title: "${c.title}" | channelId: ${c.channelId} | customUrl: ${c.customUrl} | userId: ${c.userId} | orgId: ${c.organizationId}`);
  });

  console.log('\n=== USERS ===');
  const users = await db.collection('users').find({}).toArray();
  users.forEach(u => {
    console.log(`ID: ${u._id} | email: "${u.email}" | name: "${u.name}" | orgId: ${u.organizationId}`);
  });

  console.log('\n=== VIDEOS BY CHANNEL ===');
  const videoStats = await db.collection('videos').aggregate([
    { $group: { _id: "$channelId", count: { $sum: 1 } } }
  ]).toArray();
  console.log(videoStats);

  console.log('\n=== AUTOREPLYLOGS BY CHANNEL ===');
  const autoReplyStats = await db.collection('autoreplylogs').aggregate([
    { $group: { _id: "$channelId", count: { $sum: 1 } } }
  ]).toArray();
  console.log(autoReplyStats);

  console.log('\n=== MODERATIONLOGS BY CHANNEL ===');
  const modStats = await db.collection('moderationlogs').aggregate([
    { $group: { _id: "$channelId", count: { $sum: 1 } } }
  ]).toArray();
  console.log(modStats);

  console.log('\n=== LEADS BY CHANNEL ===');
  const leadStats = await db.collection('leads').aggregate([
    { $group: { _id: "$channelId", count: { $sum: 1 } } }
  ]).toArray();
  console.log(leadStats);

  // Check for orphan videoIds in AutoReplyLogs that have no matching Video document
  const videoIdsInLogs = await db.collection('autoreplylogs').distinct('videoId');
  const existingVideoIds = await db.collection('videos').distinct('videoId');
  const missingVideoIds = videoIdsInLogs.filter(v => v && !existingVideoIds.includes(v));
  console.log('\n=== MISSING VIDEO IDs IN AUTOREPLYLOGS (causes "Unknown Video") ===');
  console.log(missingVideoIds);

  process.exit(0);
};

run().catch(e => { console.error(e); process.exit(1); });
