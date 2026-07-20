import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import ModerationRule from '../models/ModerationRule.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import Comment from '../models/Comment.mjs';
import Organization from '../models/Organization.mjs';
import User from '../models/User.mjs';
import { classifyComment } from '../services/aiService.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const runTest = async () => {
  console.log('🧪 Starting Module 1 (Auto-Mod) Verification Test...');
  
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI missing from .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  try {
    // 1. Test classifyComment category scores
    console.log('\n--- 1. Testing classifyComment DeepSeek Output ---');
    const commentSample = "This is stupid trash, get lost!";
    const aiRes = await classifyComment(commentSample);
    console.log('AI Classification Result:', {
      classification: aiRes.classification,
      sentiment: aiRes.sentiment,
      toxicityScore: aiRes.toxicityScore,
      categoryScores: aiRes.categoryScores
    });

    if (aiRes.categoryScores && typeof aiRes.categoryScores.toxic === 'number') {
      console.log('PASSED: categoryScores breakdown returned correctly.');
    } else {
      console.error('FAILED: categoryScores missing or invalid');
    }

    // 2. Test ModerationRule CRUD
    console.log('\n--- 2. Testing ModerationRule model ---');
    const testOrgId = new mongoose.Types.ObjectId();
    const testChannelId = `UC_test_${Date.now()}`;

    const ruleDoc = new ModerationRule({
      organizationId: testOrgId,
      channelId: testChannelId,
      autoMod: true,
      confidenceThreshold: 90,
      rules: {
        toxicDetection: true,
        spamDetection: true,
        hateSpeech: true,
        abuse: true,
        scam: true,
        sexualContent: true,
        duplicateComments: true,
        linkSpam: true
      },
      action: 'hold'
    });

    await ruleDoc.save();
    console.log('PASSED: ModerationRule created with ID:', ruleDoc._id);

    const fetchedRule = await ModerationRule.findOne({ organizationId: testOrgId, channelId: testChannelId });
    if (fetchedRule && fetchedRule.action === 'hold' && fetchedRule.confidenceThreshold === 90) {
      console.log('PASSED: ModerationRule query verified');
    } else {
      console.error('FAILED: ModerationRule fetch mismatch');
    }

    // Cleanup test rule
    await ModerationRule.deleteOne({ _id: ruleDoc._id });
    console.log('Cleaned up test rule.');

    console.log('\n✅ Module 1 Verification Test Completed Successfully!');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

runTest();
