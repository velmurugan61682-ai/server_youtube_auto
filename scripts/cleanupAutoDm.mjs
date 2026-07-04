/**
 * cleanupAutoDm.mjs — One-time migration script
 * 
 * Finds and cleans up invalid Auto DM configurations:
 * 1. Disables configs where the videoId doesn't exist in the Video collection.
 * 2. Deletes configs with obviously fake/test video IDs.
 * 3. Logs a summary of all actions taken.
 *
 * Usage:
 *   cd server
 *   node scripts/cleanupAutoDm.mjs
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ── Models ──────────────────────────────────────────────────────
import AutoDmConfig from '../models/AutoDmConfig.js';
import Video from '../models/Video.mjs';

// ── Config ──────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is missing from .env. Cannot proceed.');
  process.exit(1);
}

const INVALID_VIDEO_ID_PATTERNS = [
  /^test/i,
  /^example/i,
  /^placeholder/i,
  /^xxx/i,
  /^fake/i,
  /^demo/i,
  /^sample/i,
];

const isInvalidVideoId = (videoId) => {
  if (!videoId || typeof videoId !== 'string') return true;
  if (videoId.trim().length < 6) return true;
  return INVALID_VIDEO_ID_PATTERNS.some((pattern) => pattern.test(videoId.trim()));
};

// ── Main ────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Auto DM Config Cleanup Migration Script');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Connecting to: ${MONGODB_URI.replace(/\/\/(.+?):(.+?)@/, '//$1:***@')}`);
  console.log('');

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('✅ MongoDB connected.\n');

  const allConfigs = await AutoDmConfig.find();
  console.log(`📋 Total Auto DM configs found: ${allConfigs.length}\n`);

  let deletedCount = 0;
  let disabledCount = 0;
  let alreadyDisabledCount = 0;
  let healthyCount = 0;

  for (const config of allConfigs) {
    const videoId = config.videoId;
    const enabled = config.enabled;

    // ── Step 1: Delete configs with obviously fake/test videoIds ──
    if (isInvalidVideoId(videoId)) {
      console.log(`  🗑️  DELETE  videoId="${videoId}"  (placeholder/test pattern detected)`);
      await AutoDmConfig.deleteOne({ _id: config._id });
      deletedCount++;
      continue;
    }

    // ── Step 2: Disable configs where video doesn't exist in DB ──
    const videoExists = await Video.exists({ videoId });
    if (!videoExists) {
      if (enabled) {
        console.log(`  ⏸️  DISABLE videoId="${videoId}"  (video not found in Video collection)`);
        config.enabled = false;
        await config.save();
        disabledCount++;
      } else {
        console.log(`  ℹ️  SKIP    videoId="${videoId}"  (already disabled, video not found)`);
        alreadyDisabledCount++;
      }
      continue;
    }

    // ── Step 3: Config is healthy ──
    console.log(`  ✅ OK      videoId="${videoId}"  enabled=${enabled}`);
    healthyCount++;
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Total configs scanned:  ${allConfigs.length}`);
  console.log(`  Deleted (fake/test):    ${deletedCount}`);
  console.log(`  Disabled (no video):    ${disabledCount}`);
  console.log(`  Already disabled:       ${alreadyDisabledCount}`);
  console.log(`  Healthy:                ${healthyCount}`);
  console.log('═══════════════════════════════════════════════════════════');

  await mongoose.connection.close();
  console.log('\n✅ MongoDB connection closed. Migration complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Migration script failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
