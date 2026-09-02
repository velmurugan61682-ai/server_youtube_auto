import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const channelSchema = new mongoose.Schema({}, { strict: false });
const Channel = mongoose.model('Channel', channelSchema);

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

const commentSchema = new mongoose.Schema({}, { strict: false });
const Comment = mongoose.model('Comment', commentSchema);

await mongoose.connect(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 10000 });

const channels = await Channel.find({}).lean();
const users = await User.find({}).lean();
const totalComments = await Comment.countDocuments();
const pendingComments = await Comment.countDocuments({ status: 'pending' });
const repliedComments = await Comment.countDocuments({ hasReplied: true });

console.log('=== SYSTEM HEALTH REPORT ===');
console.log(`Total Connected Users: ${users.length}`);
console.log(`Total Channels: ${channels.length}`);
console.log(`Total Comments: ${totalComments} (Replied: ${repliedComments}, Pending: ${pendingComments})`);
console.log('\n=== CHANNELS STATUS ===');

channels.forEach((c, idx) => {
  console.log(`\n[${idx + 1}] Title: ${c.title || c.channelTitle || 'N/A'} | ID: ${c.channelId}`);
  console.log(`    Status: ${c.status || 'connected'} | Reconnect Required: ${c.reconnectRequired || false}`);
  if (c.reconnectReason) {
    console.log(`    Reconnect Reason: ${c.reconnectReason}`);
  }
  console.log(`    Has Custom API Key: ${!!c.apiKey}`);
  console.log(`    Updated At: ${c.updatedAt || 'N/A'}`);
});

await mongoose.disconnect();
process.exit(0);
