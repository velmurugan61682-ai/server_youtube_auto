import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import Lead from '../models/Lead.mjs';
import AutoLikeLog from '../models/AutoLikeLog.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import ModerationLog from '../models/ModerationLog.mjs';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const users = await User.find({}).lean();
  
  console.log('--- STATS PER USER ---');
  for (const u of users) {
    const channelDocs = await Channel.find({ userId: u._id }).lean();
    const channelIds = channelDocs.map(c => c.channelId);
    
    const commentsCount = await Comment.countDocuments({ userId: u._id });
    const leadsCount = await Lead.countDocuments({ userId: u._id });
    const autoLikeCount = await AutoLikeLog.countDocuments({ userId: u._id });
    const autoReplyCount = await AutoReplyLog.countDocuments({ userId: u._id });
    const moderationCount = await ModerationLog.countDocuments({ userId: u._id });
    
    // Also query by organizationId if they share organization
    const orgFilter = { organizationId: u.organizationId };
    const orgComments = await Comment.countDocuments(orgFilter);
    const orgLeads = await Lead.countDocuments(orgFilter);
    const orgLikes = await AutoLikeLog.countDocuments(orgFilter);
    const orgReplies = await AutoReplyLog.countDocuments(orgFilter);
    const orgModerations = await ModerationLog.countDocuments(orgFilter);
    
    console.log(`User: ${u.email} (${u.role})`);
    console.log(`  Personal Counts: comments=${commentsCount}, leads=${leadsCount}, autoLikes=${autoLikeCount}, autoReplies=${autoReplyCount}, moderation=${moderationCount}`);
    console.log(`  Org (${u.organizationId}) Counts: comments=${orgComments}, leads=${orgLeads}, autoLikes=${orgLikes}, autoReplies=${orgReplies}, moderation=${orgModerations}`);
  }
  
  process.exit(0);
}

run();
