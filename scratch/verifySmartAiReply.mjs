import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifyComment } from '../services/aiService.mjs';
import { getDashboardStats } from '../controllers/dashboardController.mjs';
import User from '../models/User.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const runTest = async () => {
  console.log('🧪 Starting ChannelMate AI Smart Comment Reply, Auto Moderation & Dashboard Test...');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI missing from .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  try {
    // ------------------------------------------------------------
    // Test Case 1: English positive comment
    // ------------------------------------------------------------
    console.log('\n--- Test 1: English Safe/Appreciative Comment ---');
    const safeComment = "Your video is very useful thank you";
    console.log(`Input comment: "${safeComment}"`);
    const res1 = await classifyComment(safeComment);
    console.log('Result:', {
      classification: res1.classification,
      sentiment: res1.sentiment,
      isToxic: res1.isToxic,
      suggestedReply: res1.suggestedReply
    });

    if (res1.isToxic === false) {
      console.log('✅ PASS: isToxic is false');
    } else {
      console.error('❌ FAIL: expected isToxic to be false');
    }

    if (res1.suggestedReply !== undefined) {
      console.log(`✅ PASS: suggestedReply returned: "${res1.suggestedReply}"`);
    } else {
      console.error('❌ FAIL: expected suggestedReply field to be present');
    }

    // ------------------------------------------------------------
    // Test Case 2: Toxic Comment
    // ------------------------------------------------------------
    console.log('\n--- Test 2: Toxic/Abusive Comment ---');
    const toxicComment = "You are stupid useless creator";
    console.log(`Input comment: "${toxicComment}"`);
    const res2 = await classifyComment(toxicComment);
    console.log('Result:', {
      classification: res2.classification,
      sentiment: res2.sentiment,
      isToxic: res2.isToxic,
      suggestedReply: res2.suggestedReply
    });

    if (res2.isToxic === true) {
      console.log('✅ PASS: isToxic is true');
    } else {
      console.error('❌ FAIL: expected isToxic to be true');
    }

    if (res2.suggestedReply === null) {
      console.log('✅ PASS: suggestedReply is null');
    } else {
      console.error(`❌ FAIL: expected suggestedReply to be null, got: "${res2.suggestedReply}"`);
    }

    // ------------------------------------------------------------
    // Test Case 3: Tamil Comment
    // ------------------------------------------------------------
    console.log('\n--- Test 3: Tamil Comment ---');
    const tamilComment = "உங்கள் வீடியோ நல்லா இருக்கு";
    console.log(`Input comment: "${tamilComment}"`);
    const res3 = await classifyComment(tamilComment);
    console.log('Result:', {
      classification: res3.classification,
      sentiment: res3.sentiment,
      isToxic: res3.isToxic,
      suggestedReply: res3.suggestedReply
    });

    if (res3.isToxic === false) {
      console.log('✅ PASS: isToxic is false');
    } else {
      console.error('❌ FAIL: expected isToxic to be false');
    }

    // ------------------------------------------------------------
    // Test Case 4: Tanglish Comment
    // ------------------------------------------------------------
    console.log('\n--- Test 4: Tanglish Comment ---');
    const tanglishComment = "unga video romba super bro";
    console.log(`Input comment: "${tanglishComment}"`);
    const res4 = await classifyComment(tanglishComment);
    console.log('Result:', {
      classification: res4.classification,
      sentiment: res4.sentiment,
      isToxic: res4.isToxic,
      suggestedReply: res4.suggestedReply
    });

    if (res4.isToxic === false) {
      console.log('✅ PASS: isToxic is false');
    } else {
      console.error('❌ FAIL: expected isToxic to be false');
    }

    // ------------------------------------------------------------
    // Test Case 5: Dashboard Stats Endpoint
    // ------------------------------------------------------------
    console.log('\n--- Test 5: Dashboard Stats Logic ---');
    const firstUser = await User.findOne();
    if (!firstUser) {
      console.warn('⚠️ No user found in database to run stats test. Skipping Test 5.');
    } else {
      console.log(`Running stats test for user: ${firstUser.email} (ID: ${firstUser._id})`);
      
      const req = {
        user: {
          id: firstUser._id.toString(),
          organizationId: firstUser.organizationId ? firstUser.organizationId.toString() : null
        }
      };

      let jsonSent = null;
      const res = {
        json: (data) => {
          jsonSent = data;
        },
        status: (code) => {
          console.log(`Response Status: ${code}`);
          return res;
        }
      };

      await getDashboardStats(req, res);
      console.log('Stats Result:', jsonSent);

      if (jsonSent && 
          'toxicComments' in jsonSent && 
          'autoShield' in jsonSent && 
          'autoReplies' in jsonSent && 
          'positiveComments' in jsonSent) {
        console.log('✅ PASS: Dashboard stats return schema matches expectations!');
      } else {
        console.error('❌ FAIL: Dashboard stats failed to return correct schema:', jsonSent);
      }
    }

    console.log('\n🎉 ChannelMate Smart AI Reply Verification Test Suite Completed!');
  } catch (err) {
    console.error('❌ Test execution encountered an error:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

runTest();
