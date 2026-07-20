import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.mjs';
import Organization from '../models/Organization.mjs';
import Subscription from '../models/Subscription.mjs';
import Channel from '../models/Channel.mjs';
import { requireActiveSubscription, checkChannelLimit } from '../middleware/subscription.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

const runTest = async () => {
  console.log('🧪 Starting Module 3 (Subscription) Verification Test...');
  
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI missing from .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  try {
    // 1. Test Active Trial User
    console.log('\n--- 1. Testing User within 30-day Free Trial ---');
    const recentUser = new User({
      name: 'Recent User',
      email: `recent_${Date.now()}@test.com`,
      password: 'hashedpassword',
      createdAt: new Date() // Just created
    });
    await recentUser.save();

    const req1 = { user: { id: recentUser._id.toString() } };
    const res1 = mockRes();
    let nextCalled1 = false;

    await requireActiveSubscription(req1, res1, () => { nextCalled1 = true; });
    if (nextCalled1) {
      console.log('PASSED: User within 30-day trial passed subscription check.');
    } else {
      console.error('FAILED: Recent user blocked by subscription check:', res1.body);
    }

    // 2. Test Expired Trial User without Paid Subscription
    console.log('\n--- 2. Testing User with Expired Trial & No Subscription ---');
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const expiredUser = new User({
      name: 'Expired User',
      email: `expired_${Date.now()}@test.com`,
      password: 'hashedpassword',
      createdAt: fortyDaysAgo
    });
    await expiredUser.save();

    const req2 = { user: { id: expiredUser._id.toString() } };
    const res2 = mockRes();
    let nextCalled2 = false;

    await requireActiveSubscription(req2, res2, () => { nextCalled2 = true; });
    if (!nextCalled2 && res2.statusCode === 402 && res2.body.subscriptionRequired) {
      console.log('PASSED: Expired trial user correctly blocked with 402 status.');
    } else {
      console.error('FAILED: Expired user check mismatch:', res2.statusCode, res2.body);
    }

    // 3. Test Channel Limit Enforcement (1 channel max)
    console.log('\n--- 3. Testing 1 Channel Limit Enforcement ---');
    const testChan1 = new Channel({
      userId: recentUser._id,
      channelId: `UC_test1_${Date.now()}`,
      title: 'Channel 1'
    });
    await testChan1.save();

    const req3 = { user: { id: recentUser._id.toString() }, planType: 'free' };
    const res3 = mockRes();
    let nextCalled3 = false;

    await checkChannelLimit(req3, res3, () => { nextCalled3 = true; });
    if (!nextCalled3 && res3.statusCode === 403 && res3.body.limitReached) {
      console.log('PASSED: Channel limit (max 1 channel) correctly blocked 2nd channel attempt.');
    } else {
      console.error('FAILED: Channel limit enforcement failed:', res3.statusCode, res3.body);
    }

    // Cleanup
    await User.deleteMany({ _id: { $in: [recentUser._id, expiredUser._id] } });
    await Channel.deleteOne({ _id: testChan1._id });
    console.log('Cleaned up test users and channel.');

    console.log('\n✅ Module 3 Verification Test Completed Successfully!');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

runTest();
