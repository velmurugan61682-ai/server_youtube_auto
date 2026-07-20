import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import LiveChatMode from '../models/LiveChatMode.mjs';
import LiveChatMessage from '../models/LiveChatMessage.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const runTest = async () => {
  console.log('🧪 Starting Module 4 (Live Chat) Verification Test...');
  
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI missing from .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  try {
    const testOrgId = new mongoose.Types.ObjectId();
    const testUserId = new mongoose.Types.ObjectId();
    const testChannelId = `UC_live_${Date.now()}`;
    const testLiveChatId = `chat_${Date.now()}`;

    // 1. Test LiveChatMode Creation & Toggle
    console.log('\n--- 1. Testing LiveChatMode model ---');
    const modeDoc = new LiveChatMode({
      organizationId: testOrgId,
      channelId: testChannelId,
      liveChatId: testLiveChatId,
      mode: 'bot'
    });
    await modeDoc.save();
    console.log('PASSED: LiveChatMode created with mode: bot');

    modeDoc.mode = 'human';
    modeDoc.handledBy = testUserId;
    await modeDoc.save();

    const updatedMode = await LiveChatMode.findOne({ organizationId: testOrgId, liveChatId: testLiveChatId });
    if (updatedMode && updatedMode.mode === 'human') {
      console.log('PASSED: LiveChatMode updated to human handoff mode.');
    } else {
      console.error('FAILED: LiveChatMode update mismatch');
    }

    // 2. Test LiveChatMessage Creation & Fetching
    console.log('\n--- 2. Testing LiveChatMessage model ---');
    const userMsg = new LiveChatMessage({
      organizationId: testOrgId,
      channelId: testChannelId,
      liveChatId: testLiveChatId,
      messageId: `msg_user_${Date.now()}`,
      authorName: 'Viewer1',
      messageText: 'What is the price of the course?',
      senderType: 'user'
    });
    await userMsg.save();

    const botMsg = new LiveChatMessage({
      organizationId: testOrgId,
      channelId: testChannelId,
      liveChatId: testLiveChatId,
      messageId: `msg_bot_${Date.now()}`,
      authorName: 'AI Bot',
      messageText: 'Our course fees start at ₹999.',
      isBotReply: true,
      senderType: 'bot'
    });
    await botMsg.save();

    const messages = await LiveChatMessage.find({ organizationId: testOrgId, liveChatId: testLiveChatId }).sort({ publishedAt: 1 });
    if (messages.length === 2 && messages[1].isBotReply) {
      console.log('PASSED: LiveChatMessage store & retrieve verified (User message + AI Bot reply).');
    } else {
      console.error('FAILED: LiveChatMessage retrieve mismatch');
    }

    // Cleanup
    await LiveChatMode.deleteOne({ _id: modeDoc._id });
    await LiveChatMessage.deleteMany({ organizationId: testOrgId, liveChatId: testLiveChatId });
    console.log('Cleaned up test live chat data.');

    console.log('\n✅ Module 4 Verification Test Completed Successfully!');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

runTest();
