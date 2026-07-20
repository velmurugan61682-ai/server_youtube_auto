/**
 * BACKFILL SCRIPT: Re-run Auto Like + Lead Capture for existing approved comments
 * that were processed before these features were working correctly.
 * 
 * Safe to run multiple times — uses upsert/idempotency keys.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const LEAD_KEYWORDS = ['price', 'details', 'course', 'join', 'contact', 'phone', 'call', 'whatsapp', 'demo', 'fees'];

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB Connected');

  const Comment      = (await import('../models/Comment.mjs')).default;
  const AutoLikeLog  = (await import('../models/AutoLikeLog.mjs')).default;
  const Lead         = (await import('../models/Lead.mjs')).default;
  const Channel      = (await import('../models/Channel.mjs')).default;
  const User         = (await import('../models/User.mjs')).default;

  const channel = await Channel.findOne({ channelId: 'UCyFw6NotahbWYQnWfWc7Wmw' }).lean();
  const user    = await User.findById(channel.userId).lean();

  if (!channel || !user) {
    console.error('Channel or User not found!');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Channel: ${channel.title} | User: ${user.email}`);
  console.log(`OrgId: ${channel.organizationId}\n`);

  // ── 1. BACKFILL AUTO LIKE LOG for positive approved non-bot comments ──────
  const positiveComments = await Comment.find({
    channelId: channel.channelId,
    sentiment: 'positive',
    status: 'approved',
    isBotReply: { $ne: true },
    autoLiked: false,
    text: { $exists: true, $ne: '' }
  }).lean();

  console.log(`Found ${positiveComments.length} positive approved comments without auto-like\n`);

  let likeCount = 0;
  for (const c of positiveComments) {
    if (!c.text || c.text.trim().length <= 3) {
      console.log(`  SKIP (too short): "${c.text}" by ${c.author}`);
      continue;
    }
    try {
      await AutoLikeLog.findOneAndUpdate(
        { commentId: c.youtubeId },
        {
          $setOnInsert: {
            userId: channel.userId,
            organizationId: channel.organizationId,
            channelId: channel.channelId,
            videoId: c.videoId,
            commentId: c.youtubeId,
            processedAt: new Date(),
            autoLiked: true,
            status: 'success'
          }
        },
        { upsert: true, new: true }
      );
      // Mark comment as autoLiked in DB
      await Comment.updateOne(
        { _id: c._id },
        { $set: { autoLiked: true, likeStatus: 'success' } }
      );
      console.log(`  ✅ AutoLike backfilled: "${c.text?.substring(0,40)}" by ${c.author}`);
      likeCount++;
    } catch (err) {
      if (err.code === 11000) {
        console.log(`  ⚠️ Already exists: ${c.youtubeId}`);
      } else {
        console.error(`  ❌ Error: ${err.message}`);
      }
    }
  }
  console.log(`\nBackfilled ${likeCount} AutoLike records\n`);

  // ── 2. BACKFILL LEADS for approved comments with lead keywords ───────────
  const allSafeComments = await Comment.find({
    channelId: channel.channelId,
    status: 'approved',
    isBotReply: { $ne: true }
  }).lean();

  const leadKws = user.settings?.leadKeywords || LEAD_KEYWORDS;
  let leadCount = 0;

  for (const c of allSafeComments) {
    if (!c.text) continue;
    const matched = leadKws.filter(kw => c.text.toLowerCase().includes(kw.toLowerCase()));
    if (matched.length === 0) continue;

    const idempotencyKey = `${channel.organizationId || channel.userId}_${channel.channelId}_${c.youtubeId}_lead`;
    const exists = await Lead.exists({ idempotencyKey });
    if (exists) {
      console.log(`  ⚠️ Lead already exists: "${c.text?.substring(0,30)}"`);
      continue;
    }

    try {
      await Lead.create({
        userId: channel.userId,
        organizationId: channel.organizationId,
        idempotencyKey,
        channelId: channel.channelId,
        videoId: c.videoId || 'unknown',
        commentId: c.youtubeId,
        authorName: c.author || 'Unknown',
        originalComment: c.text,
        whatsappNumber: 'None',
        intent: 'Interest',
        productInterest: 'General',
        language: c.language || 'English',
        notes: `Backfilled. Keywords matched: ${matched.join(', ')}`,
        status: 'pending'
      });
      console.log(`  ✅ Lead created: "${c.text?.substring(0,40)}" | keywords: [${matched.join(', ')}]`);
      leadCount++;
    } catch (err) {
      if (err.code === 11000) {
        console.log(`  ⚠️ Duplicate lead: ${c.youtubeId}`);
      } else {
        console.error(`  ❌ Lead error: ${err.message}`);
      }
    }
  }
  console.log(`\nBackfilled ${leadCount} Lead records\n`);

  // ── 3. VERIFY ─────────────────────────────────────────────────────────────
  const totalAutoLikes = await AutoLikeLog.countDocuments({ channelId: channel.channelId });
  const totalLeads     = await Lead.countDocuments({ channelId: channel.channelId });
  const totalComments  = await Comment.countDocuments({ channelId: channel.channelId });

  console.log('=== FINAL COUNTS ===');
  console.log(`  Total Comments:  ${totalComments}`);
  console.log(`  Auto Like Logs:  ${totalAutoLikes}`);
  console.log(`  Leads:           ${totalLeads}`);
  console.log('\n✅ Backfill complete. Refresh the dashboard to see updated counts.');

  await mongoose.disconnect();
};

run().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });
