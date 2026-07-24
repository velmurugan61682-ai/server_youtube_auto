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

    // Print count and samples of ModerationLog
    const moderationCount = await mongoose.connection.db.collection('moderationlogs').countDocuments({});
    console.log('Total ModerationLogs:', moderationCount);
    const modLogs = await mongoose.connection.db.collection('moderationlogs').find({}).limit(2).toArray();
    console.log('Sample ModerationLog:', JSON.stringify(modLogs, null, 2));

    // Print count and samples of AutoLikeLog
    const autoLikeCount = await mongoose.connection.db.collection('autolikelogs').countDocuments({});
    console.log('Total AutoLikeLogs:', autoLikeCount);
    const likeLogs = await mongoose.connection.db.collection('autolikelogs').find({}).limit(2).toArray();
    console.log('Sample AutoLikeLog:', JSON.stringify(likeLogs, null, 2));

    // Print count and samples of AutoReplyLog
    const autoReplyCount = await mongoose.connection.db.collection('autoreplylogs').countDocuments({});
    console.log('Total AutoReplyLogs:', autoReplyCount);
    const replyLogs = await mongoose.connection.db.collection('autoreplylogs').find({}).limit(2).toArray();
    console.log('Sample AutoReplyLog:', JSON.stringify(replyLogs, null, 2));

    // Print count and samples of Lead
    const leadCount = await mongoose.connection.db.collection('leads').countDocuments({});
    console.log('Total Leads:', leadCount);
    const leads = await mongoose.connection.db.collection('leads').find({}).limit(2).toArray();
    console.log('Sample Lead:', JSON.stringify(leads, null, 2));

    // Print count and samples of Comment
    const commentCount = await mongoose.connection.db.collection('comments').countDocuments({});
    console.log('Total Comments:', commentCount);

    // Print channels
    const channelCount = await mongoose.connection.db.collection('channels').countDocuments({});
    console.log('Total Channels:', channelCount);

    process.exit(0);
  } catch (err) {
    console.error('Error running diagnostics:', err);
    process.exit(1);
  }
}

run();
