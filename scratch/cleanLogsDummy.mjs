import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Comment from '../models/Comment.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import CommentAutomationLog from '../models/CommentAutomationLog.mjs';
import Lead from '../models/Lead.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function cleanAllLogs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const res1 = await ModerationLog.deleteMany({
      $or: [
        { commentText: /dummy/i },
        { authorName: /dummy/i }
      ]
    });
    console.log(`Deleted ${res1.deletedCount} dummy ModerationLogs`);

    const res2 = await AutoReplyLog.deleteMany({
      $or: [
        { commentText: /dummy/i },
        { username: /dummy/i }
      ]
    });
    console.log(`Deleted ${res2.deletedCount} dummy AutoReplyLogs`);

    const res3 = await CommentAutomationLog.deleteMany({
      $or: [
        { commentText: /dummy/i },
        { authorName: /dummy/i }
      ]
    });
    console.log(`Deleted ${res3.deletedCount} dummy CommentAutomationLogs`);

    const res4 = await Lead.deleteMany({
      $or: [
        { originalComment: /dummy/i },
        { authorName: /dummy/i }
      ]
    });
    console.log(`Deleted ${res4.deletedCount} dummy Leads`);

    console.log('All dummy logs cleaned successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error cleaning logs:', err);
    process.exit(1);
  }
}

cleanAllLogs();
