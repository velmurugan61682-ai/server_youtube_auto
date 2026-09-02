import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const autoReplyLogSchema = new mongoose.Schema({}, { strict: false });
const AutoReplyLog = mongoose.model('AutoReplyLog', autoReplyLogSchema);

const automationLogSchema = new mongoose.Schema({}, { strict: false });
const AutomationLog = mongoose.model('AutomationLog', automationLogSchema);

await mongoose.connect(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 10000 });

const failedReplies = await AutoReplyLog.countDocuments({ status: { $in: ['error', 'failed'] } });
const errorLogs = await AutomationLog.countDocuments({ actionType: { $regex: /error/i } });
const recentLogs = await AutomationLog.find({}).sort({ timestamp: -1 }).limit(5).lean();

console.log('=== CLIENT LOGS & ERROR AUDIT ===');
console.log(`Failed Auto-Replies: ${failedReplies}`);
console.log(`Automation Error Logs: ${errorLogs}`);
console.log('\nLatest 5 System Activity Logs:');
recentLogs.forEach(l => {
  console.log(`- [${l.timestamp || l.createdAt}] User: ${l.userId} | Action: ${l.actionType} | Desc: ${l.description || 'N/A'}`);
});

await mongoose.disconnect();
process.exit(0);
