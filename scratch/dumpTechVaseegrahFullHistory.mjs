import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const channelId = 'UCdpaYm53cdH0SODoBXAKRmQ';

    // 1. Channel
    const channel = await db.collection('channels').findOne({ channelId });

    // 2. Rules
    const rules = await db.collection('autoreplyrules').find({ channelId }).toArray();

    // 3. AutoReplyLogs
    const replyLogs = await db.collection('autoreplylogs').find({ channelId }).sort({ createdAt: -1 }).toArray();

    // 4. Comments
    const comments = await db.collection('comments').find({ channelId }).sort({ publishedAt: -1 }).toArray();

    console.log('=== CHANNEL ===');
    console.log(JSON.stringify(channel, null, 2));

    console.log('\n=== RULES (' + rules.length + ') ===');
    rules.forEach((r, i) => console.log(`${i+1}. RuleID: ${r._id} | Keywords: ${r.triggerKeywords?.join(', ')} | Type: ${r.replyType} | Active: ${r.isActive} | Text: "${r.replyText}"`));

    console.log('\n=== AUTOREPLY LOGS (' + replyLogs.length + ') ===');
    replyLogs.forEach((l, i) => {
      console.log(`${i+1}. CommentID: ${l.commentId} | User: ${l.username} | Status: ${l.status} | Trigger: ${l.triggerKeyword}`);
      console.log(`    Comment: "${l.commentText}"`);
      console.log(`    Reply: "${l.replyText || l.aiReply}"`);
      console.log(`    Time: ${l.createdAt}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
