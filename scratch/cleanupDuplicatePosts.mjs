import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';

import Video from '../models/Video.mjs';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function cleanupDuplicates() {
  console.log('Connecting to MongoDB for duplicate post cleanup...');
  await mongoose.connect(uri, { family: 4 });
  console.log('✅ Connected to MongoDB\n');

  const posts = await Video.find({ isPost: true }).sort({ createdAt: -1 }).lean();
  console.log(`Found ${posts.length} total post documents in MongoDB.`);

  const seen = new Map();
  const duplicateIdsToDelete = [];

  for (const p of posts) {
    const titleKey = `${p.channelId}_${(p.title || '').trim().toLowerCase()}`;
    if (seen.has(titleKey)) {
      console.log(`[DUPLICATE FOUND] ID: ${p._id} | videoId: ${p.videoId} | title: "${p.title}"`);
      duplicateIdsToDelete.push(p._id);
    } else {
      seen.set(titleKey, p._id);
    }
  }

  if (duplicateIdsToDelete.length > 0) {
    console.log(`\nDeleting ${duplicateIdsToDelete.length} duplicate post records...`);
    const deleteResult = await Video.deleteMany({ _id: { $in: duplicateIdsToDelete } });
    console.log(`✅ Deleted ${deleteResult.deletedCount} duplicate post documents.`);
  } else {
    console.log('✅ No duplicate post records found.');
  }

  await mongoose.disconnect();
  console.log('Cleanup complete.');
  process.exit(0);
}

cleanupDuplicates().catch(err => {
  console.error('Cleanup Error:', err);
  process.exit(1);
});
