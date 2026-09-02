import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import all models
import Comment from '../models/Comment.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import LiveChatMessage from '../models/LiveChatMessage.mjs';
import CommentAutomationLog from '../models/CommentAutomationLog.mjs';
import Lead from '../models/Lead.mjs';
import AutoLikeLog from '../models/AutoLikeLog.mjs';
import CommentLog from '../models/CommentLog.js';

async function checkIndexes() {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected successfully.\n');

  const models = [
    { name: 'Comment', model: Comment },
    { name: 'AutoReplyLog', model: AutoReplyLog },
    { name: 'ModerationLog', model: ModerationLog },
    { name: 'LiveChatMessage', model: LiveChatMessage },
    { name: 'CommentAutomationLog', model: CommentAutomationLog },
    { name: 'Lead', model: Lead },
    { name: 'AutoLikeLog', model: AutoLikeLog },
    { name: 'CommentLog', model: CommentLog }
  ];

  console.log('=== SYNCING AND VERIFYING MONGODB INDEXES ===\n');

  const results = {};

  for (const { name, model } of models) {
    try {
      console.log(`Syncing indexes for ${name}...`);
      await model.syncIndexes();
      const indexes = await model.collection.indexes();
      results[name] = indexes;
      console.log(`[PASS] ${name}: ${indexes.length} indexes verified.`);
      const ttlIndex = indexes.find(idx => idx.expireAfterSeconds !== undefined);
      if (ttlIndex) {
        console.log(`  -> TTL Index confirmed: key=${JSON.stringify(ttlIndex.key)}, expireAfterSeconds=${ttlIndex.expireAfterSeconds}`);
      } else {
        console.log(`  -> [WARN] No TTL index found for ${name}`);
      }
    } catch (err) {
      console.error(`[ERROR] Syncing indexes for ${name}:`, err.message);
      try {
        const existing = await model.collection.indexes();
        results[name] = existing;
      } catch (e) {
        results[name] = `Error: ${e.message}`;
      }
    }
  }

  console.log('\n=== FULL INDEX AUDIT REPORT ===');
  console.log(JSON.stringify(results, null, 2));

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB.');
}

checkIndexes().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
