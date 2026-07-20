import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import CommentAutomationRule from '../models/CommentAutomationRule.mjs';
import CommentAutomationLog from '../models/CommentAutomationLog.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const runTest = async () => {
  console.log('🧪 Starting Module 2 (Comment Automation) Verification Test...');
  
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI missing from .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  try {
    const testOrgId = new mongoose.Types.ObjectId();
    const testUserId = new mongoose.Types.ObjectId();
    const testChannelId = `UC_auto_${Date.now()}`;

    // 1. Create a rule with wildcard triggerText and text ruleType
    const rule = new CommentAutomationRule({
      userId: testUserId,
      organizationId: testOrgId,
      channelId: testChannelId,
      name: 'Test Automation Rule',
      triggerText: '*',
      ruleType: 'text',
      replyText: 'Thanks for commenting {{username}}!',
      videoIds: ['vid_123', 'vid_456'],
      status: 'Active'
    });

    await rule.save();
    console.log('PASSED: CommentAutomationRule created with ID:', rule._id);

    // 2. Query rule
    const fetchedRule = await CommentAutomationRule.findOne({
      organizationId: testOrgId,
      channelId: testChannelId
    });
    if (fetchedRule && fetchedRule.triggerText === '*' && fetchedRule.ruleType === 'text') {
      console.log('PASSED: CommentAutomationRule fields verified (* wildcard & text ruleType)');
    } else {
      console.error('FAILED: CommentAutomationRule fetch mismatch');
    }

    // 3. Create a CommentAutomationLog entry
    const log = new CommentAutomationLog({
      userId: testUserId,
      organizationId: testOrgId,
      ruleId: rule._id,
      channelId: testChannelId,
      videoId: 'vid_123',
      commentId: `comm_${Date.now()}`,
      authorName: 'TestUser',
      commentText: 'Awesome video!',
      matchedKeyword: '*',
      generatedReply: 'Thanks for commenting TestUser!',
      status: 'Replied',
      processedAt: new Date()
    });

    await log.save();
    console.log('PASSED: CommentAutomationLog created with ID:', log._id);

    // Cleanup test data
    await CommentAutomationRule.deleteOne({ _id: rule._id });
    await CommentAutomationLog.deleteOne({ _id: log._id });
    console.log('Cleaned up test rule and log.');

    console.log('\n✅ Module 2 Verification Test Completed Successfully!');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

runTest();
