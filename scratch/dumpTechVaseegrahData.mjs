import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const channelId = 'UCdpaYm53cdH0SODoBXAKRmQ';

    // 1. Fetch Channel Info
    const channel = await db.collection('channels').findOne({ channelId });
    
    // 2. Fetch Authorized Users
    const techOrgId = channel ? channel.organizationId : null;
    const users = await db.collection('users').find({
      $or: [
        { organizationId: techOrgId },
        { email: { $in: ['techvaseegrah@gmail.com', 'tech@gmail.com', 'techvaseegrah@ciphergate.in'] } }
      ]
    }).toArray();

    // 3. Fetch Videos Summary & List
    const videos = await db.collection('videos').find({ channelId }).sort({ publishedAt: -1 }).toArray();

    // 4. Fetch Comments
    const comments = await db.collection('comments').find({ channelId }).sort({ publishedAt: -1 }).toArray();

    // 5. Fetch AutoReply Logs
    const replyLogs = await db.collection('autoreplylogs').find({ channelId }).sort({ createdAt: -1 }).toArray();

    console.log('====================================================');
    console.log('       TECH VASEEGRAH COMPLETE DATA REPORT          ');
    console.log('====================================================\n');

    console.log('--- 1. CHANNEL OVERVIEW ---');
    if (channel) {
      console.log(`Title:              ${channel.title}`);
      console.log(`Channel ID:         ${channel.channelId}`);
      console.log(`Custom URL:         ${channel.customUrl || 'N/A'}`);
      console.log(`Status:             ${channel.status}`);
      console.log(`Subscribers:        ${channel.statistics?.subscriberCount || '0'}`);
      console.log(`Total Channel Views:${channel.statistics?.viewCount || '0'}`);
      console.log(`Total Channel Videos:${channel.statistics?.videoCount || '0'}`);
      console.log(`Uploads Playlist:   ${channel.uploadsPlaylistId || 'N/A'}`);
      console.log(`Last Synced At:     ${channel.lastSyncedAt || 'N/A'}`);
      console.log(`Description:        ${channel.description?.substring(0, 100)}...`);
    } else {
      console.log('Channel document not found');
    }

    console.log('\n--- 2. AUTHORIZED USERS & ACCOUNTS ---');
    users.forEach(u => {
      console.log(` - User ID: ${u._id} | Email: ${u.email} | Name: ${u.name || 'N/A'} | Role: ${u.role || 'client'}`);
    });

    console.log(`\n--- 3. VIDEOS IN DATABASE (${videos.length} Total) ---`);
    console.log('Top 10 Most Recent Videos:');
    videos.slice(0, 10).forEach((v, i) => {
      const stats = v.statistics || {};
      console.log(` [${i + 1}] Title: "${v.title}"`);
      console.log(`     Video ID: ${v.videoId} | Published: ${v.publishedAt ? new Date(v.publishedAt).toISOString().split('T')[0] : 'N/A'}`);
      console.log(`     Views: ${stats.viewCount || 0} | Likes: ${stats.likeCount || 0} | Comments: ${stats.commentCount || 0}`);
    });

    console.log(`\n--- 4. COMMENTS IN DATABASE (${comments.length} Total) ---`);
    if (comments.length === 0) {
      console.log(' No comments stored currently in MongoDB for Tech Vaseegrah.');
    } else {
      comments.slice(0, 5).forEach((c, i) => {
        console.log(` [${i + 1}] Author: ${c.author || c.username} | Text: "${c.text || c.commentText}"`);
        console.log(`     Published: ${c.publishedAt} | Status: ${c.status || 'approved'}`);
      });
    }

    console.log(`\n--- 5. AUTO-REPLY LOGS (${replyLogs.length} Total) ---`);
    if (replyLogs.length === 0) {
      console.log(' No auto-reply logs recorded yet.');
    } else {
      replyLogs.slice(0, 5).forEach((l, i) => {
        console.log(` [${i + 1}] Comment ID: ${l.commentId} | Status: ${l.status}`);
        console.log(`     Reply Text: "${l.replyText}"`);
      });
    }

    console.log('\n====================================================');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
