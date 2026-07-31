import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const targetOrgId = new mongoose.Types.ObjectId('6a61e033f3e45a716947e418');

    // 1. Update Organization for all Tech Vaseegrah / Tech / Velmurugan accounts
    const techEmails = [
      'techvaseegrah@gmail.com',
      'tech@gmail.com',
      'techvaseegrah@ciphergate.in',
      'velmurugan61682@gmail.com',
      'velmurugan@gmail.com',
      'channelmate@gmail.com'
    ];

    console.log('--- UPDATING ORGANIZATIONS FOR TECH USERS ---');
    const userRes = await db.collection('users').updateMany(
      { email: { $in: techEmails } },
      { $set: { organizationId: targetOrgId } }
    );
    console.log(`Users updated: ${userRes.modifiedCount}`);

    // Get primary tech user
    const primaryUser = await db.collection('users').findOne({ email: 'techvaseegrah@gmail.com' }) ||
                        await db.collection('users').findOne({ email: 'tech@gmail.com' });

    const primaryUserId = primaryUser ? primaryUser._id : new mongoose.Types.ObjectId('6a61ab6013a05a496c6ec738');
    console.log(`Primary User ID chosen: ${primaryUserId} (Email: ${primaryUser ? primaryUser.email : 'fallback'})`);

    // 2. Update Channel
    console.log('--- UPDATING CHANNEL TECH VASEEGRAH ---');
    const chanRes = await db.collection('channels').updateMany(
      { channelId: 'UCdpaYm53cdH0SODoBXAKRmQ' },
      { $set: { organizationId: targetOrgId, userId: primaryUserId } }
    );
    console.log(`Channels updated: ${chanRes.modifiedCount}`);

    // 3. Clean duplicates & Update Videos
    console.log('--- DEDUPLICATING AND UPDATING VIDEOS FOR TECH VASEEGRAH ---');
    const allVideos = await db.collection('videos').find({ channelId: 'UCdpaYm53cdH0SODoBXAKRmQ' }).toArray();
    
    // Group videos by videoId
    const videoMap = new Map();
    for (const v of allVideos) {
      if (!videoMap.has(v.videoId)) {
        videoMap.set(v.videoId, []);
      }
      videoMap.get(v.videoId).push(v);
    }

    let keptCount = 0;
    let deletedCount = 0;

    for (const [videoId, list] of videoMap.entries()) {
      // Pick the primary video doc (prefer one with analysis or most recent)
      list.sort((a, b) => (b.analysis?.analyzedAt ? 1 : 0) - (a.analysis?.analyzedAt ? 1 : 0));
      const keepDoc = list[0];
      const removeDocs = list.slice(1);

      // Update kept document
      await db.collection('videos').updateOne(
        { _id: keepDoc._id },
        { $set: { userId: primaryUserId, organizationId: targetOrgId } }
      );
      keptCount++;

      // Delete duplicate documents
      for (const rm of removeDocs) {
        await db.collection('videos').deleteOne({ _id: rm._id });
        deletedCount++;
      }
    }
    console.log(`Videos processed: Kept ${keptCount}, Removed ${deletedCount} duplicates.`);

    // 4. Update Comments
    console.log('--- UPDATING COMMENTS FOR TECH VASEEGRAH ---');
    const commRes = await db.collection('comments').updateMany(
      { channelId: 'UCdpaYm53cdH0SODoBXAKRmQ' },
      { $set: { organizationId: targetOrgId, userId: primaryUserId } }
    );
    console.log(`Comments updated: ${commRes.modifiedCount}`);

    console.log('🎉 SUCCESS! All Tech Vaseegrah data re-linked to organization and primary user cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('Error fixing Tech Vaseegrah data:', err);
    process.exit(1);
  }
};

run();
