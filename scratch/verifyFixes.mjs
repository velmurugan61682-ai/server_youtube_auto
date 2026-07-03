import '../config/env.mjs';
import mongoose from 'mongoose';
import { acquireLock, releaseLock } from '../utils/lockHelper.mjs';
import WorkerLock from '../models/WorkerLock.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import { generateAndPostAutoReply } from '../services/autoReplyService.mjs';
import logger from '../utils/logger.mjs';

async function testLocks() {
  logger.info('🧪 Testing Distributed Lock...');
  const lockKey = 'test_lock_' + Date.now();

  // 1. Acquire Lock
  const lock1 = await acquireLock(lockKey, 5000); // 5 seconds lock
  if (lock1) {
    logger.info('✅ Lock 1 acquired successfully.');
  } else {
    logger.error('❌ Lock 1 acquisition failed.');
  }

  // 2. Try to acquire duplicate Lock
  const lock2 = await acquireLock(lockKey, 5000);
  if (!lock2) {
    logger.info('✅ Concurrency check passed: Lock 2 failed to acquire.');
  } else {
    logger.error('❌ Concurrency check failed: Lock 2 acquired in parallel.');
  }

  // 3. Release Lock
  await releaseLock(lockKey);
  logger.info('✅ Lock released.');

  // 4. Try to acquire Lock again (should succeed since released)
  const lock3 = await acquireLock(lockKey, 5000);
  if (lock3) {
    logger.info('✅ Lock 3 acquired successfully after release.');
  } else {
    logger.error('❌ Lock 3 acquisition failed.');
  }
  await releaseLock(lockKey);
}

async function testAutoReplyLocksAndFallbacks() {
  logger.info('🧪 Testing Auto Reply Idempotency and Fallbacks...');
  const commentId = 'mock_comment_' + Date.now();
  const videoId = 'mock_video_123';
  const userId = new mongoose.Types.ObjectId();

  // Clean up any existing logs
  await AutoReplyLog.deleteOne({ commentId });

  // Test 1: Successful locking and generate reply
  logger.info('1. Running first auto-reply attempt...');
  // We pass a mock youtube object that responds successfully to replyToComment
  const mockYoutube = {
    comments: {
      insert: async () => {
        return { status: 200, data: {} };
      }
    }
  }; 

  const result1 = await generateAndPostAutoReply({
    youtube: mockYoutube,
    parentId: commentId,
    commentText: 'நன்றி நண்பா! அருமையான பதிவு (Thank you friend! Excellent video)',
    commentId,
    videoId,
    userId,
    userKey: null // Uses process.env.DEEPSEEK_API_KEY
  });

  logger.info(`Result 1: ${JSON.stringify(result1)}`);
  if (result1.success && !result1.alreadyReplied) {
    logger.info('✅ First reply generated and logged successfully.');
  } else {
    logger.error('❌ First reply failed.');
  }

  // Test 2: Double reply prevention (Idempotency)
  logger.info('2. Running duplicate auto-reply attempt...');
  const result2 = await generateAndPostAutoReply({
    youtube: mockYoutube,
    parentId: commentId,
    commentText: 'நன்றி நண்பா! அருமையான பதிவு',
    commentId,
    videoId,
    userId
  });

  logger.info(`Result 2: ${JSON.stringify(result2)}`);
  if (result2.success && result2.alreadyReplied) {
    logger.info('✅ Duplicate reply blocked and skipped correctly.');
  } else {
    logger.error('❌ Duplicate reply was not correctly blocked.');
  }

  // Clean up
  await AutoReplyLog.deleteOne({ commentId });
}

async function main() {
  try {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('✅ Connected to MongoDB.');

    await testLocks();
    await testAutoReplyLocksAndFallbacks();

    logger.info('🎉 All verification tasks finished!');
    process.exit(0);
  } catch (error) {
    logger.error('Verification failed:', error);
    process.exit(1);
  }
}

main();
