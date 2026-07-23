import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB Connected\n');

  const Comment = (await import('../models/Comment.mjs')).default;
  const AutoLikeLog = (await import('../models/AutoLikeLog.mjs')).default;
  const Lead = (await import('../models/Lead.mjs')).default;
  const ModerationLog = (await import('../models/ModerationLog.mjs')).default;
  const AutoReplyLog = (await import('../models/AutoReplyLog.mjs')).default;
  const User = (await import('../models/User.mjs')).default;
  const Channel = (await import('../models/Channel.mjs')).default;

  // ── CHANNEL SETTINGS ──────────────────────────────────────────
  const user = await User.findOne({ email: 'ChannelMate@gmail.com' }).lean();
  console.log('=== USER SETTINGS ===');
  console.log('autoLike:', user?.settings?.autoLike);
  console.log('autoMod:', user?.settings?.autoMod);
  console.log('confidenceThreshold:', user?.settings?.confidenceThreshold);
  console.log('leadKeywords:', JSON.stringify(user?.settings?.leadKeywords));
  console.log();

  // ── CHANNEL ────────────────────────────────────────────────────
  const channel = await Channel.findOne({ channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' }).lean();
  console.log('=== CHANNEL ===');
  console.log('Title:', channel?.title);
  console.log('statistics:', JSON.stringify(channel?.statistics));
  console.log('organizationId:', channel?.organizationId);
  console.log();

  // ── ALL COMMENTS ───────────────────────────────────────────────
  const comments = await Comment.find({}).select('youtubeId text author sentiment status hasReplied replyStatus autoLiked publishedAt').lean();
  console.log(`=== COMMENTS (${comments.length} total) ===`);
  comments.forEach(c => {
    console.log(`  [${c.status}] [${c.sentiment}] hasReplied=${c.hasReplied} autoLiked=${c.autoLiked} replyStatus=${c.replyStatus} | "${c.text?.substring(0, 40)}" by ${c.author}`);
  });
  console.log();

  // ── AUTO LIKE LOG ──────────────────────────────────────────────
  const autoLikes = await AutoLikeLog.find({}).lean();
  console.log(`=== AutoLikeLog (${autoLikes.length} records) ===`);
  autoLikes.forEach(a => console.log(`  commentId=${a.commentId} autoLiked=${a.autoLiked} status=${a.status}`));
  console.log();

  // ── LEAD COLLECTION ────────────────────────────────────────────
  const leads = await Lead.find({}).lean();
  console.log(`=== Leads (${leads.length} records) ===`);
  leads.forEach(l => console.log(`  author=${l.authorName} comment="${l.originalComment?.substring(0, 40)}" status=${l.status}`));
  console.log();

  // ── MODERATION LOGS ────────────────────────────────────────────
  const modLogs = await ModerationLog.find({}).lean();
  console.log(`=== ModerationLog (${modLogs.length} records) ===`);
  modLogs.forEach(m => console.log(`  commentId=${m.commentId} action=${m.executedAction} status=${m.status} category=${m.category}`));
  console.log();

  // ── CHECK: WHY AUTO LIKE IS NOT TRIGGERING FOR POSITIVE COMMENTS ──
  const positiveComments = comments.filter(c => c.sentiment === 'positive');
  console.log(`=== POSITIVE COMMENTS (${positiveComments.length}) ===`);
  positiveComments.forEach(c => {
    const textLen = c.text?.trim().length || 0;
    const isMeaningful = textLen > 3;
    const isProcessed = c.status === 'approved' || c.status === 'deleted';
    console.log(`  "${c.text?.substring(0, 30)}" | autoLiked=${c.autoLiked} | status=${c.status} | hasReplied=${c.hasReplied} | textLen=${textLen} | meaningful=${isMeaningful} | already_processed=${isProcessed}`);
  });
  console.log();

  // ── CHECK: LEAD KEYWORDS IN EXISTING COMMENTS ─────────────────
  const defaultLeadKws = ['price', 'details', 'course', 'join', 'contact', 'phone', 'call', 'whatsapp', 'demo', 'fees'];
  const leadKws = user?.settings?.leadKeywords || defaultLeadKws;
  console.log(`=== LEAD KEYWORD MATCH CHECK ===`);
  comments.forEach(c => {
    const matches = leadKws.filter(kw => c.text?.toLowerCase().includes(kw));
    if (matches.length > 0) {
      console.log(`  MATCH: "${c.text?.substring(0, 40)}" → keywords: [${matches.join(', ')}] | status=${c.status}`);
    }
  });
  console.log();

  // ── ROOT CAUSE SUMMARY ─────────────────────────────────────────
  console.log('=== ROOT CAUSE ANALYSIS ===');
  const alreadyProcessed = comments.filter(c => c.status !== 'pending' && c.status !== 'processing');
  console.log(`${alreadyProcessed.length}/${comments.length} comments already processed - they will NOT re-trigger pipeline`);
  console.log('Auto Like fires only on NEW comments that have sentiment=positive and are meaningful');
  console.log('Leads fire only on NEW comments with lead keywords');
  console.log('To trigger: post a new comment on the YouTube channel from a non-owner account');

  await mongoose.disconnect();
};

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
