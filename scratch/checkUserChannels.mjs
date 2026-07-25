import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import Lead from '../models/Lead.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const user = await User.findOne({ email: 'test@gmail.com' });
  if (!user) {
    console.log('User test@gmail.com not found!');
    process.exit(0);
  }
  
  console.log('--- USER INFO ---');
  console.log(`ID: ${user._id}`);
  console.log(`Email: ${user.email}`);
  console.log(`Role: ${user.role}`);
  console.log(`Org ID: ${user.organizationId}`);
  
  const channels = await Channel.find({ userId: user._id });
  console.log(`\n--- CHANNELS FOR THIS USER (${channels.length}) ---`);
  channels.forEach(c => {
    console.log(`Title: ${c.title}, Channel ID: ${c.channelId}, Status: ${c.status}`);
  });
  
  const comments = await Comment.find({ userId: user._id });
  console.log(`\n--- COMMENTS FOR THIS USER (${comments.length}) ---`);
  
  const leads = await Lead.find({ userId: user._id });
  console.log(`\n--- LEADS FOR THIS USER (${leads.length}) ---`);
  
  const modLogs = await ModerationLog.find({ userId: user._id });
  console.log(`\n--- MODERATION LOGS FOR THIS USER (${modLogs.length}) ---`);
  
  const replyLogs = await AutoReplyLog.find({ userId: user._id });
  console.log(`\n--- AUTO REPLY LOGS FOR THIS USER (${replyLogs.length}) ---`);
  
  // Also check if there are channels with userId equal to string but not ObjectId
  const allChannels = await Channel.find({});
  console.log(`\n--- ALL CHANNELS (${allChannels.length}) ---`);
  allChannels.forEach(c => {
    console.log(`Title: ${c.title}, User ID: ${c.userId} (Type: ${typeof c.userId}), Org ID: ${c.organizationId}`);
  });

  process.exit(0);
}

run();
