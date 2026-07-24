import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Comment from '../models/Comment.mjs';
import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to Database');

    // Mimic the exact variables inside analyticsController:
    const reqUser = {
      id: '6a61ab6013a05a496c6ec738',
      email: 'tech@gmail.com',
      role: 'client',
      organizationId: '6a58b3fca56b7151cdd2d250'
    };

    // Date range passed from client Dashboard:
    // Let's check with different possible timezone/string representations
    const dateRange = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    };

    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);

    console.log('Testing channel queries:');
    const q1 = await Channel.find({
      $or: [
        { organizationId: new mongoose.Types.ObjectId(reqUser.organizationId) },
        { userId: new mongoose.Types.ObjectId(reqUser.id) }
      ]
    }).lean();
    console.log('Channels found:', q1.map(c => c.channelId));

    const channelIds = q1.map(c => c.channelId);
    const channelFilter = { $in: channelIds };

    const filterUser = { $or: [{ organizationId: new mongoose.Types.ObjectId(reqUser.organizationId) }, { _id: new mongoose.Types.ObjectId(reqUser.id) }] };
    const users = await User.find(filterUser).select('_id').lean();
    const userIds = users.map(u => u._id);

    const commentDateWindow = {
      $or: [
        { publishedAt: { $gte: start, $lte: end } },
        { createdAt: { $gte: start, $lte: end } }
      ]
    };

    const commentBaseQuery = (...conditions) => ({
      userId: { $in: userIds },
      channelId: channelFilter,
      isBotReply: { $ne: true },
      $and: [commentDateWindow, ...conditions]
    });

    const totalComments = await Comment.countDocuments(commentBaseQuery());
    const totalPositive = await Comment.countDocuments(commentBaseQuery({
      $or: [
        { sentiment: /^positive$/i },
        { classification: /^positive$/i }
      ]
    }));
    const totalToxic = await Comment.countDocuments(commentBaseQuery({
      $or: [
        { sentiment: /^toxic$/i },
        { classification: { $in: [/^toxic$/i, /^spam$/i, /^hate speech$/i, /^abuse$/i, /^threat$/i, /^scam$/i, /^sexual content$/i] } },
        { status: 'deleted' }
      ]
    }));
    const totalModerate = await Comment.countDocuments(commentBaseQuery({
      $or: [
        { sentiment: /^moderate$/i },
        { status: { $in: ['moderate', 'flagged'] } }
      ]
    }));

    console.log('Counts computed:');
    console.log('Total comments (Engagement):', totalComments);
    console.log('Positive:', totalPositive);
    console.log('Toxic:', totalToxic);
    console.log('Moderate:', totalModerate);

    // Language breakdown aggregation query
    const languageBreakdown = await Comment.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          channelId: channelFilter,
          isBotReply: { $ne: true },
          $and: [commentDateWindow]
        }
      },
      {
        $group: {
          _id: '$language',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    console.log('Language Breakdown:', languageBreakdown);

    process.exit(0);
  } catch (err) {
    console.error('Error running diagnostics:', err);
    process.exit(1);
  }
}

run();
