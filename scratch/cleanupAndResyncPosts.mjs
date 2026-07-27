import '../config/env.mjs';
import mongoose from 'mongoose';
import Video from '../models/Video.mjs';
import Comment from '../models/Comment.mjs';
import Channel from '../models/Channel.mjs';
import { scrapeCommunityPosts } from '../services/youtubeService.mjs';

async function cleanupAndResync() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const beforeCount = await Video.countDocuments({ isPost: true });
  console.log(`BEFORE CLEANUP: Total Community Posts in DB = ${beforeCount}`);

  // 1. Delete all fake simulated fallback posts and their associated seed comments
  const fakePosts = await Video.find({
    isPost: true,
    videoId: { $regex: /^(post_internship_|post_whatsapp_order_|scraped_post_)/ }
  }).lean();

  const fakeVideoIds = fakePosts.map(p => p.videoId);
  if (fakeVideoIds.length > 0) {
    const deletedComments = await Comment.deleteMany({ videoId: { $in: fakeVideoIds } });
    const deletedPosts = await Video.deleteMany({ _id: { $in: fakePosts.map(p => p._id) } });
    console.log(`✓ Deleted ${deletedPosts.deletedCount} fake/simulated posts and ${deletedComments.deletedCount} seed comments.`);
  }

  // 2. Remove any duplicate real posts in DB (keep only 1 per channelId + videoId)
  const allPosts = await Video.find({ isPost: true }).lean();
  const seen = new Set();
  const duplicateIds = [];

  for (const post of allPosts) {
    const key = `${post.channelId}_${post.videoId}`;
    if (seen.has(key)) {
      duplicateIds.push(post._id);
    } else {
      seen.add(key);
    }
  }

  if (duplicateIds.length > 0) {
    const dedupRes = await Video.deleteMany({ _id: { $in: duplicateIds } });
    console.log(`✓ Deleted ${dedupRes.deletedCount} duplicate post records from database.`);
  }

  // 3. Re-sync real community posts for connected channel(s)
  const channels = await Channel.find().lean();
  for (const ch of channels) {
    console.log(`\nRe-syncing real community posts for channel: "${ch.title}" (${ch.channelId})...`);
    let scraped = [];
    if (ch.customUrl || ch.channelId) {
      scraped = await scrapeCommunityPosts(ch.customUrl, ch.channelId);
    }
    console.log(`Found ${scraped.length} real community posts on YouTube for channel "${ch.title}".`);

    for (let i = 0; i < scraped.length; i++) {
      const p = scraped[i];
      const postId = p.postId || `yt_post_${ch.channelId}_${i}`;
      await Video.findOneAndUpdate(
        { channelId: ch.channelId, videoId: postId },
        {
          $set: {
            userId: ch.userId,
            channelId: ch.channelId,
            videoId: postId,
            title: p.text.split('\n')[0] || 'Community Post',
            description: p.text,
            thumbnail: p.thumbnail || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=150',
            publishedAt: new Date(),
            isPost: true,
            analyzed: true,
            statistics: { viewCount: 0, likeCount: 0, commentCount: 0 },
            lastFetchedAt: new Date()
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
    }
  }

  const afterCount = await Video.countDocuments({ isPost: true });
  console.log(`\nAFTER CLEANUP & RE-SYNC: Total Community Posts in DB = ${afterCount}`);

  await mongoose.disconnect();
}

cleanupAndResync().catch(console.error);
