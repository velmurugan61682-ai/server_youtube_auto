import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import mongoose from 'mongoose';
import Lead from '../models/Lead.mjs';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  console.log('Connecting to:', uri);
  await mongoose.connect(uri);
  console.log('Connected!\n');

  // Check users
  const users = await User.find({});
  console.log(`=== USERS (${users.length}) ===`);
  users.forEach(u => {
    console.log(`- ID: ${u._id} | Email: ${u.email} | Name: ${u.name} | OrgId: ${u.organizationId}`);
  });

  // Check channels
  const channels = await Channel.find({});
  console.log(`\n=== CHANNELS (${channels.length}) ===`);
  channels.forEach(c => {
    console.log(`- ChannelId: ${c.channelId} | Title: ${c.title} | UserID: ${c.userId}`);
    console.log(`  reconnectRequired: ${c.reconnectRequired} | reconnectReason: ${c.reconnectReason}`);
    console.log(`  hasAccessToken: ${!!c.accessToken} | hasRefreshToken: ${!!c.refreshToken} | apiKey: ${c.apiKey}`);
  });


  // Check leads
  const leads = await Lead.find({});
  console.log(`\n=== LEADS (${leads.length}) ===`);
  leads.forEach((l, index) => {
    if (index < 10) {
      console.log(`- ID: ${l._id} | Author: ${l.authorName} | Num: ${l.whatsappNumber} | Status: ${l.status} | UserID: ${l.userId} | ChannelId: ${l.channelId}`);
    }
  });
  if (leads.length > 10) {
    console.log(`... and ${leads.length - 10} more.`);
  }

  // Check comments
  const comments = await Comment.find({ $or: [{ author: /JokerKilar/i }, { text: /gyugyu/i }] });
  console.log(`\n=== TARGET COMMENTS (${comments.length}) ===`);
  comments.forEach((c) => {
    console.log(`- ID: ${c._id} | Text: "${c.text}" | Author: ${c.author} | VideoID: ${c.videoId} | status: ${c.status} | classification: ${c.classification}`);
    console.log(`  aiActionTaken: ${c.aiActionTaken} | deleteFailed: ${c.deleteFailed} | deleteError: ${c.deleteError}`);
    console.log(`  moderationStatus: ${c.moderationStatus} | aiStatus: ${c.aiStatus}`);
  });


  await mongoose.disconnect();

}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
