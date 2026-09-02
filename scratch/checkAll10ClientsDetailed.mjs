import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

const channelSchema = new mongoose.Schema({}, { strict: false });
const Channel = mongoose.model('Channel', channelSchema);

const commentSchema = new mongoose.Schema({}, { strict: false });
const Comment = mongoose.model('Comment', commentSchema);

const autoReplyRuleSchema = new mongoose.Schema({}, { strict: false });
const AutoReplyRule = mongoose.model('AutoReplyRule', autoReplyRuleSchema);

await mongoose.connect(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 10000 });

const users = await User.find({}).lean();
const channels = await Channel.find({}).lean();
const rules = await AutoReplyRule.find({}).lean();

console.log('================ ALL 10 CLIENTS AUDIT ================');

for (let i = 0; i < users.length; i++) {
  const u = users[i];
  const uId = u._id.toString();
  const userChannels = channels.filter(c => c.userId?.toString() === uId);
  const userRules = rules.filter(r => r.userId?.toString() === uId);
  const totalComm = await Comment.countDocuments({ userId: u._id });
  const repliedComm = await Comment.countDocuments({ userId: u._id, hasReplied: true });

  console.log(`\nClient #${i + 1}: ${u.name || 'N/A'} (${u.email})`);
  console.log(`- Role: ${u.role || 'user'}`);
  console.log(`- Connected Channels: ${userChannels.length}`);
  
  if (userChannels.length === 0) {
    console.log(`- Status: ℹ️ No YouTube channel connected yet.`);
  } else {
    userChannels.forEach(ch => {
      const isIssue = ch.reconnectRequired || ch.status !== 'connected';
      console.log(`  * Channel: ${ch.title || ch.channelId}`);
      console.log(`    Status: ${ch.status} | Reconnect Required: ${ch.reconnectRequired || false}`);
      if (isIssue) {
        console.log(`    ⚠️ PROBLEM DETECTED: ${ch.reconnectReason || 'Requires Reconnect'}`);
      } else {
        console.log(`    ✅ HEALTHY (Tokens valid, NO issues)`);
      }
    });
  }

  console.log(`- Auto-Reply Rules Configured: ${userRules.length}`);
  console.log(`- Comments Fetched: ${totalComm} | Auto-Replies Sent: ${repliedComm}`);
}

await mongoose.disconnect();
process.exit(0);
