import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const missingVideoIds = ['5vBY8Jj5Wds', 'LF55pVitnxY'];

  console.log('=== AUTOREPLYLOGS WITH MISSING VIDEO IDs ===');
  const arLogs = await db.collection('autoreplylogs').find({ videoId: { $in: missingVideoIds } }).toArray();
  arLogs.forEach(l => {
    console.log(`ID: ${l._id} | videoId: ${l.videoId} | commentId: ${l.commentId} | username: ${l.username} | text: "${l.commentText?.slice(0, 30)}" | trigger: "${l.triggerKeyword}"`);
  });

  console.log('\n=== MODERATIONLOGS WITH MISSING VIDEO IDs ===');
  const modLogs = await db.collection('moderationlogs').find({ videoId: { $in: missingVideoIds } }).toArray();
  modLogs.forEach(l => {
    console.log(`ID: ${l._id} | videoId: ${l.videoId} | commentId: ${l.commentId} | author: ${l.authorName} | text: "${l.commentText?.slice(0, 30)}"`);
  });

  console.log('\n=== LEADS WITH MISSING VIDEO IDs ===');
  const leadLogs = await db.collection('leads').find({ videoId: { $in: missingVideoIds } }).toArray();
  leadLogs.forEach(l => {
    console.log(`ID: ${l._id} | videoId: ${l.videoId} | author: ${l.authorName} | originalComment: "${l.originalComment?.slice(0, 30)}"`);
  });

  console.log('\n=== CHECK LEADS API ROUTE AND LEADS DATA ===');
  const allLeads = await db.collection('leads').find({}).limit(5).toArray();
  allLeads.forEach(l => {
    console.log(`Lead ID: ${l._id} | author: ${l.authorName} | channelId: ${l.channelId} | userId: ${l.userId} | orgId: ${l.organizationId}`);
  });

  process.exit(0);
};

run().catch(e => { console.error(e); process.exit(1); });
