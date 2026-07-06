import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import mongoose from 'mongoose';
import Comment from '../models/Comment.mjs';
import AutoDmConfig from '../models/AutoDmConfig.js';
import RepliedComment from '../models/RepliedComment.js';
import Channel from '../models/Channel.mjs';

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('Connected!\n');

  // Show ALL comments for video 5vBY8Jj5Wds with full info
  const allComments = await Comment.find({ videoId: '5vBY8Jj5Wds' }).sort({ publishedAt: -1 }).limit(20);
  console.log('=== ALL Comments for 5vBY8Jj5Wds (newest 20) ===');
  allComments.forEach(c => {
    console.log('---');
    console.log('  youtubeId:', c.youtubeId);
    console.log('  text:', (c.text || '').substring(0, 100));
    console.log('  author:', c.author);
    console.log('  authorChannelId:', c.authorChannelId);
    console.log('  isBotReply:', c.isBotReply, '| hasReplied:', c.hasReplied, '| aiActionTaken:', c.aiActionTaken);
    console.log('  aiStatus:', c.aiStatus, '| status:', c.status, '| classification:', c.classification);
    console.log('  replyStatus:', c.replyStatus, '| moderationStatus:', c.moderationStatus);
  });

  // Check RepliedComment for this video
  const replies = await RepliedComment.find({ videoId: '5vBY8Jj5Wds' }).sort({ repliedAt: -1 }).limit(10);
  console.log('\n=== RepliedComment log for 5vBY8Jj5Wds ===');
  if (replies.length === 0) console.log('  None found.');
  replies.forEach(r => {
    console.log('  commentId:', r.commentId, '| matchedKeyword:', r.matchedKeyword);
    console.log('    commentText:', (r.commentText || '').substring(0, 80));
    console.log('    replyText:', (r.replyText || '').substring(0, 100));
    console.log('    repliedAt:', r.repliedAt);
  });

  // Check the channel channelId
  const channel = await Channel.findOne({});
  console.log('\n=== Channel channelId ===', channel?.channelId);

  // Find comments whose authorChannelId matches channel.channelId (these are flagged as botOwnComment)
  if (channel) {
    const channelComments = await Comment.find({ videoId: '5vBY8Jj5Wds', authorChannelId: channel.channelId });
    console.log('\n=== Comments with authorChannelId matching channel (' + channel.channelId + ') ===');
    if (channelComments.length === 0) console.log('  None');
    channelComments.forEach(c => {
      console.log('  id:', c.youtubeId, '| text:', (c.text || '').substring(0,80), '| isBotReply:', c.isBotReply);
    });
  }

  // Show template issue
  const config = await AutoDmConfig.findOne({ videoId: '5vBY8Jj5Wds' });
  if (config) {
    console.log('\n=== Reply Templates (RAW from DB) ===');
    config.replyTemplates.forEach((t, i) => {
      console.log('  Template', i, ':', t);
      const hasWhatsappLink = t.includes('{whatsapp_link}');
      const hasBrokenUrl = /{https?:\/\//.test(t);
      console.log('    has {whatsapp_link}:', hasWhatsappLink, '| has broken URL-in-braces:', hasBrokenUrl);
    });
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
