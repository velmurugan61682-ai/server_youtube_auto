import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Channel = (await import('../models/Channel.mjs')).default;
    const Video = (await import('../models/Video.mjs')).default;
    const { scrapeCommunityPosts } = await import('../services/youtubeService.mjs');

    // 1. Delete old duplicate or fallback post records from MongoDB
    const deletedRes = await Video.deleteMany({
      $or: [
        { isPost: true },
        { videoId: /^yt_post_/ }
      ]
    });
    console.log(`Deleted ${deletedRes.deletedCount} old/duplicate post records from DB.`);

    // 2. Resync real community posts for all channels
    const channels = await Channel.find({}).lean();
    for (const channel of channels) {
      console.log(`Syncing community posts for channel: ${channel.title} (${channel.channelId})`);
      const scraped = await scrapeCommunityPosts(channel.customUrl, channel.channelId);
      console.log(`Scraped ${scraped.length} posts for ${channel.title}`);

      for (const p of scraped) {
        if (!p.postId) continue;
        await Video.updateOne(
          { channelId: channel.channelId, videoId: p.postId },
          {
            $set: {
              userId: channel.userId,
              channelId: channel.channelId,
              videoId: p.postId,
              title: (p.text || '').split('\n')[0] || 'Community Post',
              description: p.text,
              thumbnail: p.thumbnail || '',
              isPost: true,
              analyzed: true,
              statistics: { viewCount: 0, likeCount: 0, commentCount: 0 },
              lastFetchedAt: new Date()
            },
            $setOnInsert: {
              publishedAt: new Date()
            }
          },
          { upsert: true }
        );
        console.log(`  ✓ Synced post: ${p.postId} - Thumbnail: ${p.thumbnail ? 'YES (Real YouTube Image)' : 'NO'}`);
      }
    }

    await mongoose.disconnect();
    console.log('✅ Community posts resynchronization completed cleanly!');
  } catch (err) {
    console.error('Error during resync:', err);
    process.exit(1);
  }
};

run();
