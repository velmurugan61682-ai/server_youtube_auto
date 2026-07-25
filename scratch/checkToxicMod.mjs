import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Comment from '../models/Comment.mjs';
import ModerationLog from '../models/ModerationLog.mjs';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const userId = new mongoose.Types.ObjectId('6a61ab6013a05a496c6ec738');

  const mLogs = await ModerationLog.find({ userId }).lean();
  console.log('ModerationLogs count:', mLogs.length);
  mLogs.forEach(l => console.log('Log:', { action: l.action, executedAction: l.executedAction, status: l.status, category: l.category, commentText: l.commentText }));

  const cToxic = await Comment.find({ userId, $or: [{ sentiment: /^toxic$/i }, { status: 'deleted' }, { moderationStatus: 'deleted' }] }).lean();
  console.log('Toxic comments count in Comment coll:', cToxic.length);

  const cMod = await Comment.find({ userId, $or: [{ sentiment: /^moderate$/i }, { status: 'flagged' }, { status: 'moderate' }] }).lean();
  console.log('Moderate comments count in Comment coll:', cMod.length);

  process.exit(0);
}

check();
