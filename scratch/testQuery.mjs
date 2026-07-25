import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Comment from '../models/Comment.mjs';

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const userId = new mongoose.Types.ObjectId('6a61ab6013a05a496c6ec738');
  const channelFilter = { $in: ['UCdpaYm53cdH0SODoBXAKRmQ'] };

  const now = new Date();
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const commentDateWindow = {
    $or: [
      { publishedAt: { $gte: defaultStart, $lte: now } },
      { createdAt: { $gte: defaultStart, $lte: now } }
    ]
  };

  const baseQueryWithDate = {
    userId,
    channelId: channelFilter,
    isBotReply: { $ne: true },
    $and: [commentDateWindow]
  };

  const baseQueryNoDate = {
    userId,
    channelId: channelFilter,
    isBotReply: { $ne: true }
  };

  const cWithDate = await Comment.countDocuments(baseQueryWithDate);
  const cNoDate = await Comment.countDocuments(baseQueryNoDate);

  console.log('Count WITH date filter:', cWithDate);
  console.log('Count WITHOUT date filter:', cNoDate);

  const sample = await Comment.findOne(baseQueryNoDate).lean();
  console.log('Sample comment dates:', {
    publishedAt: sample?.publishedAt,
    createdAt: sample?.createdAt,
    defaultStart,
    now
  });

  process.exit(0);
}

test();
