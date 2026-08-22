import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import ModerationLog from '../models/ModerationLog.mjs';
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';

async function test() {
  await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
  console.log('Connected to DB');

  const channel = await Channel.findOne({}).lean();
  console.log('Using channel:', {
    _id: channel._id,
    userId: channel.userId,
    organizationId: channel.organizationId,
    channelId: channel.channelId
  });

  // Test what commentProcessingService does:
  const testCommentDoc = {
    youtubeId: 'test_comment_12345',
    videoId: 'test_video_123',
    author: 'Test User',
    text: 'Test bad comment',
    isLiveChat: false
  };

  const executedAction = 'delete';
  const loggedAction = executedAction === 'delete' ? 'deleted' : 'hidden';
  const deleteFailed = false;

  const modLogData = {
    userId: channel.userId,
    organizationId: channel.organizationId,
    channelId: channel.channelId,
    videoId: testCommentDoc.videoId,
    commentId: testCommentDoc.youtubeId,
    authorName: testCommentDoc.author || 'Anonymous',
    commentText: testCommentDoc.text || '',
    category: 'toxic',
    confidence: 0.85,
    toxicityScore: 0.9,
    reason: 'Auto-detected: toxic',
    action: loggedAction,
    executedAction: loggedAction,
    status: deleteFailed ? 'Failed' : 'Success',
    failureReason: null,
    isLiveChat: testCommentDoc.isLiveChat || false,
    liveChatId: null
  };

  console.log('Attempting ModerationLog.findOneAndUpdate with data:', modLogData);
  try {
    const res = await ModerationLog.findOneAndUpdate(
      { commentId: testCommentDoc.youtubeId, userId: channel.userId },
      { $set: modLogData },
      { upsert: true, new: true }
    );
    console.log('Success inserting test ModerationLog:', res);
  } catch (err) {
    console.error('Error in findOneAndUpdate:', err);
  }

  // Check what takeAction does:
  const takeActionModLogData = {
    userId: channel.userId,
    organizationId: channel.organizationId,
    channelId: channel.channelId,
    videoId: testCommentDoc.videoId,
    commentId: 'test_takeaction_123',
    authorName: 'TakeAction Author',
    commentText: 'TakeAction text',
    category: 'toxic',
    type: 'toxic',
    confidence: 90,
    toxicityScore: 0.9,
    reason: 'Manual deletion via Comments & Moderation',
    executedAction: 'delete',
    action: 'delete',
    status: 'Success'
  };

  console.log('\nAttempting takeAction ModerationLog.findOneAndUpdate...');
  try {
    const res2 = await ModerationLog.findOneAndUpdate(
      { commentId: 'test_takeaction_123' },
      { $set: takeActionModLogData },
      { upsert: true, new: true }
    );
    console.log('Success inserting takeAction ModerationLog:', res2);
  } catch (err) {
    console.error('Error in takeAction findOneAndUpdate:', err);
  }

  // Now clean up the test docs
  await ModerationLog.deleteMany({ commentId: { $in: ['test_comment_12345', 'test_takeaction_123'] } });
  console.log('Cleaned up test documents.');

  await mongoose.disconnect();
}

test().catch(console.error);
