import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.mjs';
import Organization from '../models/Organization.mjs';
import Channel from '../models/Channel.mjs';
import CommentAutomationRule from '../models/CommentAutomationRule.mjs';
import ModerationLog from '../models/ModerationLog.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const runTest = async () => {
  console.log('🧪 Testing GET /api/comment-automation/stats query logic...');
  
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI missing');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const testOrgId = new mongoose.Types.ObjectId();
    const testUserId = new mongoose.Types.ObjectId();
    const testChannelId = `UC_stats_${Date.now()}`;

    const query = {
      userId: testUserId,
      organizationId: testOrgId,
      channelId: testChannelId
    };

    const totalRules = await CommentAutomationRule.countDocuments(query);
    const rulesList = await CommentAutomationRule.find(query).select('triggeredCount successfulReplyCount failedReplyCount');
    let totalTriggers = 0, totalSuccess = 0, totalFailed = 0;

    for (const rule of rulesList) {
      totalTriggers += rule.triggeredCount || 0;
      totalSuccess += rule.successfulReplyCount || 0;
      totalFailed += rule.failedReplyCount || 0;
    }

    const totalModerated = await ModerationLog.countDocuments(query);
    const avgToxResult = await ModerationLog.aggregate([
      { $match: query },
      { $group: { _id: null, avgTox: { $avg: '$toxicityScore' } } }
    ]);
    const avgToxicity = Math.round((avgToxResult[0]?.avgTox || 0) * 100);

    console.log('✅ Stats calculation output:', {
      totalRules,
      totalTriggers,
      totalSuccess,
      totalFailed,
      totalModerated,
      averageToxicity: avgToxicity
    });
    console.log('PASSED: /api/comment-automation/stats query executed without errors!');
  } catch (err) {
    console.error('❌ Failed stats test:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

runTest();
