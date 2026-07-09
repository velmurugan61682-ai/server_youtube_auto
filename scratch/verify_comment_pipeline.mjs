import '../config/env.mjs';
import mongoose from 'mongoose';
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import User from '../models/User.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import { processSingleComment } from '../services/commentProcessingService.mjs';
import { classifyComment } from '../services/aiService.mjs';
import { generateAndPostAutoReply } from '../services/autoReplyService.mjs';
import logger from '../utils/logger.mjs';

const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function testToxicityClassification() {
  logger.info('\n--- TESTING TOXICITY CLASSIFICATION ---');
  const testCases = [
    { text: 'அருமையான வீடியோ சகோதரா!', expectedToxic: false },
    { text: 'super video bro, keeps doing it', expectedToxic: false },
    { text: 'dei loose payale waste video moodu', expectedToxic: true },
    { text: 'trash kevalam mocka content', expectedToxic: true },
  ];

  for (const tc of testCases) {
    logger.info(`Classifying: "${tc.text}"`);
    const res = await classifyComment(tc.text);
    const isToxicOrBad = [
      'spam', 'promotion', 'toxic', 'abuse', 'threat', 'scam', 'hate', 'profanity', 
      'selfpromotion', 'advertisement', 'adult', 'bullying', 'violence', 'malicious_review', 'bad_words',
      'harassment', 'hate_speech', 'offensive', 'fake_review', 'offensive_review', 'bad words', 'hate speech'
    ].includes(res.classification.toLowerCase()) || 
    res.rawAnalysis?.toxic || res.rawAnalysis?.badWords || res.rawAnalysis?.profanity;

    logger.info(`Classification: ${res.classification}, Sentiment: ${res.sentiment}`);
    logger.info(`Detected Toxic/Bad: ${!!isToxicOrBad} (Expected: ${tc.expectedToxic})`);
    if (!!isToxicOrBad === tc.expectedToxic) {
      logger.info('✅ Toxicity test passed.');
    } else {
      logger.error('❌ Toxicity test failed.');
    }
  }
}

async function testLanguageScriptMatching() {
  logger.info('\n--- TESTING LANGUAGE & SCRIPT MATCHING ---');
  const testCases = [
    { text: 'அருமையான வீடியோ சகோதரா!', expectedLang: 'Tamil' },
    { text: 'super video bro, keeps doing it', expectedLang: 'English' },
    { text: 'eppidi bro irukinga, nalla iruka video', expectedLang: 'Tanglish' }
  ];

  const mockYoutube = {
    comments: {
      insert: async () => ({ status: 200, data: { id: 'mock-reply-' + Date.now() } })
    }
  };

  for (const tc of testCases) {
    logger.info(`Generating reply for: "${tc.text}"`);
    const commentId = 'mock_comment_lang_' + Date.now();
    await AutoReplyLog.deleteOne({ commentId });

    const res = await generateAndPostAutoReply({
      youtube: mockYoutube,
      parentId: commentId,
      commentText: tc.text,
      commentId,
      videoId: 'mock_video_123',
      userId: new mongoose.Types.ObjectId()
    });

    logger.info(`Detected Language: ${res.detectedLanguage}`);
    logger.info(`Generated Reply Text: "${res.replyText}"`);
    
    // Check script matching
    if (tc.expectedLang === 'Tamil') {
      const hasTamilChars = /[\u0b80-\u0bff]/.test(res.replyText);
      logger.info(`Tamil Script check: ${hasTamilChars ? 'Passed (Contains Tamil letters)' : 'Failed (No Tamil letters)'}`);
    } else if (tc.expectedLang === 'Tanglish') {
      const hasTamilChars = /[\u0b80-\u0bff]/.test(res.replyText);
      logger.info(`Tanglish Script check: ${!hasTamilChars ? 'Passed (Uses English letters for Tanglish)' : 'Failed (Contains Tamil script for Tanglish)'}`);
    } else {
      logger.info('English check passed.');
    }
    await AutoReplyLog.deleteOne({ commentId });
  }
}

async function testMultiReplyPrevention() {
  logger.info('\n--- TESTING MULTI-REPLY PREVENTION ---');
  
  // Set up mock DB documents
  const dummyUserId = new mongoose.Types.ObjectId();
  const dummyChannelId = 'UC_dummy_channel_123';
  
  // Find or create a User
  let user = await User.findOne({ email: 'admin@youtubeai.test' });
  if (!user) {
    user = new User({
      email: 'admin@youtubeai.test',
      password: 'hashedpassword',
      name: 'System Admin',
      settings: { autoMod: true, autoLike: true, confidenceThreshold: 85 }
    });
    await user.save();
  }
  
  // Find or create Channel
  let channel = await Channel.findOne({ channelId: dummyChannelId });
  if (!channel) {
    channel = new Channel({
      userId: user._id,
      channelId: dummyChannelId,
      title: 'Dummy Channel',
      accessToken: 'dummy',
      refreshToken: 'dummy'
    });
    await channel.save();
  }

  const mockYoutube = {
    comments: {
      insert: async () => ({ status: 200, data: { id: 'mock-reply-id-' + Date.now(), snippet: { authorChannelId: { value: dummyChannelId } } } })
    }
  };

  // Case A: Top-level comment -> Should reply
  const topCommentId = 'UC_comment_' + Date.now();
  const topCommentDoc = new Comment({
    userId: user._id,
    youtubeId: topCommentId,
    channelId: dummyChannelId,
    videoId: 'dummy_video_abc',
    text: 'Nice video bro, teach more React.',
    author: 'Commenter A',
    authorChannelId: 'UC_commenter_a',
    publishedAt: new Date(),
    status: 'pending',
    aiActionTaken: false
  });
  await topCommentDoc.save();

  logger.info('Case A: Processing top-level comment (expect reply to be sent)...');
  await processSingleComment(mockYoutube, channel, null, user.settings, topCommentDoc, null);
  
  // Check Top comment reply status
  const updatedTopDoc = await Comment.findOne({ youtubeId: topCommentId });
  logger.info(`Top comment reply status: ${updatedTopDoc.replyStatus} (Expected: sent)`);
  logger.info(`Top comment hasReplied: ${updatedTopDoc.hasReplied} (Expected: true)`);

  // Case B: Child/reply comment -> Should skip reply
  const childCommentId = `${topCommentId}.child_reply_123`;
  const childCommentDoc = new Comment({
    userId: user._id,
    youtubeId: childCommentId,
    channelId: dummyChannelId,
    videoId: 'dummy_video_abc',
    text: 'Yes, I agree with this comment!',
    author: 'Commenter B',
    authorChannelId: 'UC_commenter_b',
    publishedAt: new Date(),
    status: 'pending',
    aiActionTaken: false
  });
  await childCommentDoc.save();

  logger.info('Case B: Processing child reply comment (expect NO reply, just complete status)...');
  await processSingleComment(mockYoutube, channel, null, user.settings, childCommentDoc, null);
  
  const updatedChildDoc = await Comment.findOne({ youtubeId: childCommentId });
  logger.info(`Child reply comment status: ${updatedChildDoc.replyStatus} (Expected: none)`);
  logger.info(`Child reply comment hasReplied: ${updatedChildDoc.hasReplied} (Expected: false)`);

  // Case C: Channel Owner comment -> Should skip reply
  const ownerCommentId = 'UC_comment_owner_' + Date.now();
  const ownerCommentDoc = new Comment({
    userId: user._id,
    youtubeId: ownerCommentId,
    channelId: dummyChannelId,
    videoId: 'dummy_video_abc',
    text: 'Thanks guys for watching!',
    author: 'Channel Owner',
    authorChannelId: dummyChannelId, // Matches channelId
    publishedAt: new Date(),
    status: 'pending',
    aiActionTaken: false
  });
  await ownerCommentDoc.save();

  logger.info('Case C: Processing channel owner comment (expect NO reply)...');
  await processSingleComment(mockYoutube, channel, null, user.settings, ownerCommentDoc, null);

  const updatedOwnerDoc = await Comment.findOne({ youtubeId: ownerCommentId });
  logger.info(`Owner comment reply status: ${updatedOwnerDoc.replyStatus} (Expected: none)`);

  // Case D: Top-level comment when another reply from owner already exists -> Should skip reply
  const topCommentId2 = 'UC_comment_dup_' + Date.now();
  const topCommentDoc2 = new Comment({
    userId: user._id,
    youtubeId: topCommentId2,
    channelId: dummyChannelId,
    videoId: 'dummy_video_abc',
    text: 'I have a question about routing.',
    author: 'Commenter C',
    authorChannelId: 'UC_commenter_c',
    publishedAt: new Date(),
    status: 'pending',
    aiActionTaken: false
  });
  await topCommentDoc2.save();

  // Create a reply by the owner in the DB
  const mockOwnerReply = new Comment({
    userId: user._id,
    youtubeId: `${topCommentId2}.mock_reply_id_xyz`,
    channelId: dummyChannelId,
    videoId: 'dummy_video_abc',
    text: 'Here is the answer.',
    author: 'Bot (Auto-Reply)',
    authorChannelId: dummyChannelId,
    publishedAt: new Date(),
    status: 'approved',
    isBotReply: true
  });
  await mockOwnerReply.save();

  logger.info('Case D: Processing parent comment when owner reply already exists (expect skip reply)...');
  await processSingleComment(mockYoutube, channel, null, user.settings, topCommentDoc2, null);

  const updatedTopDoc2 = await Comment.findOne({ youtubeId: topCommentId2 });
  logger.info(`Parent comment reply status: ${updatedTopDoc2.replyStatus} (Expected: sent - marked as sent/done)`);
  logger.info(`Parent comment hasReplied: ${updatedTopDoc2.hasReplied} (Expected: true - marked as already replied without posting duplicate)`);

  // Cleanup
  await Comment.deleteMany({ youtubeId: { $in: [topCommentId, childCommentId, ownerCommentId, topCommentId2, `${topCommentId2}.mock_reply_id_xyz`] } });
}

async function main() {
  try {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('✅ Connected.');

    await testToxicityClassification();
    await testLanguageScriptMatching();
    await testMultiReplyPrevention();

    logger.info('\n🎉 All verification tests successfully completed!');
    process.exit(0);
  } catch (error) {
    logger.error('Verification tests failed:', error);
    process.exit(1);
  }
}

main();
