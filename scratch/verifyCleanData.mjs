import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const existingVideoIds = await db.collection('videos').distinct('videoId');

  const arUnknown = await db.collection('autoreplylogs').countDocuments({ videoId: { $nin: existingVideoIds } });
  const modUnknown = await db.collection('moderationlogs').countDocuments({ videoId: { $nin: existingVideoIds } });
  const leadUnknown = await db.collection('leads').countDocuments({ videoId: { $nin: existingVideoIds } });

  const velmAr = await db.collection('autoreplylogs').countDocuments({ username: /velmurugan/i });
  const velmMod = await db.collection('moderationlogs').countDocuments({ authorName: /velmurugan/i });
  const velmLead = await db.collection('leads').countDocuments({ authorName: /velmurugan/i });

  console.log('=== VERIFICATION SUMMARY ===');
  console.log('AutoReplyLogs with Unknown Video:', arUnknown);
  console.log('ModerationLogs with Unknown Video:', modUnknown);
  console.log('Leads with Unknown Video:', leadUnknown);
  console.log('AutoReplyLogs for velmurugan:', velmAr);
  console.log('ModerationLogs for velmurugan:', velmMod);
  console.log('Leads for velmurugan:', velmLead);

  process.exit(0);
};

run().catch(e => { console.error(e); process.exit(1); });
