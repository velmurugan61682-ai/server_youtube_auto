/**
 * DB Migration script: Fix incorrectly tagged isBotReply comments
 * 
 * 1. Clear isBotReply=true from comments that are NOT actual bot auto-replies
 *    (i.e., comments that are short user comments like "kena paiyan", "good", "hey bro")
 *    but were wrongly tagged because authorChannelId matched the channel.
 * 
 * 2. Ensure all comments with text matching bot reply templates (containing WhatsApp link)
 *    that were posted by the bot are properly tagged with isBotReply=true.
 * 
 * 3. Reset aiActionTaken=false on channel-owner user comments so DeepSeek re-processes them.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import mongoose from 'mongoose';
import Comment from '../models/Comment.mjs';
import RepliedComment from '../models/RepliedComment.js';

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('Connected to MongoDB!\n');

  // Channel ID
  const channelId = 'UCyFw6NotahbWYQnWfWc7Wmw';

  // 1. Find all comments tagged isBotReply=true that appear to be real user comments
  //    (i.e., they do NOT contain WhatsApp link patterns and are short natural comments)
  const potentiallyWronglyTagged = await Comment.find({ 
    isBotReply: true,
    authorChannelId: channelId
  });

  console.log('=== Reviewing isBotReply=true comments tagged by authorChannelId ===');
  let fixedCount = 0;
  let keptCount = 0;

  for (const c of potentiallyWronglyTagged) {
    const isActualBotReply = c.text && (
      c.text.includes('wa.me') ||
      c.text.includes('WhatsApp') ||
      c.text.includes('whatsapp') ||
      c.text.includes('📲') ||
      c.text.includes('💬') ||
      c.text.includes('📞')
    );

    const isReplyComment = c.youtubeId.includes('.'); // reply comments have dot in ID

    if (isActualBotReply || isReplyComment) {
      console.log('  KEEP isBotReply=true:', c.youtubeId, '|', c.text?.substring(0, 60));
      keptCount++;
    } else {
      // This is a real user comment wrongly tagged - fix it
      console.log('  FIX: Clear isBotReply=true from:', c.youtubeId, '|', c.text?.substring(0, 60));
      await Comment.updateOne(
        { _id: c._id },
        {
          $set: {
            isBotReply: false,
            authorChannelId: channelId, // keep channelId but clear bot flag
            // Reset processing so DeepSeek will re-evaluate it
            aiActionTaken: false,
            aiStatus: 'pending',
            status: 'pending',
            classification: null,
            moderationStatus: null,
            actionTaken: null,
          }
        }
      );
      fixedCount++;
    }
  }
  console.log(`\nFixed ${fixedCount} wrongly-tagged comments, kept ${keptCount} correctly-tagged bot replies.\n`);

  // 2. Ensure all bot reply comments (those with WhatsApp links) have isBotReply=true
  //    These are reply-type comments (youtubeId with dot) containing WhatsApp links
  const whatsappReplies = await Comment.find({
    $or: [
      { text: { $regex: 'wa\\.me', $options: 'i' } },
      { text: { $regex: 'WhatsApp', $options: 'i' } },
    ],
    isBotReply: false
  });

  console.log('=== Fixing bot WhatsApp reply comments missing isBotReply=true ===');
  let botFixCount = 0;
  for (const c of whatsappReplies) {
    // Only tag as bot reply if it's a reply comment (has dot in ID) or author is the channel
    if (c.youtubeId.includes('.') || c.authorChannelId === channelId) {
      console.log('  FIXING:', c.youtubeId, '|', c.text?.substring(0, 60));
      await Comment.updateOne(
        { _id: c._id },
        {
          $set: {
            isBotReply: true,
            aiActionTaken: true,
            aiStatus: 'completed',
            status: 'approved',
            classification: 'bot_reply',
            moderationStatus: 'safe',
            actionTaken: 'skip_bot',
          }
        }
      );
      botFixCount++;
    }
  }
  console.log(`Fixed ${botFixCount} bot reply comments that were missing isBotReply=true.\n`);

  // 3. Check RepliedComment log to find comments that got replied to by autoDM
  //    and mark those original comments with hasReplied=true in Comment model
  const repliedComments = await RepliedComment.find({});
  console.log('=== Syncing RepliedComment log -> Comment.hasReplied ===');
  let syncCount = 0;
  for (const rc of repliedComments) {
    if (rc.replyText && rc.replyText !== 'pending') {
      const updated = await Comment.findOneAndUpdate(
        { youtubeId: rc.commentId, hasReplied: { $ne: true } },
        {
          $set: {
            hasReplied: true,
            repliedAt: rc.repliedAt,
            replyStatus: 'sent',
            replyText: rc.replyText,
            aiActionTaken: true,
            aiStatus: 'completed',
          }
        }
      );
      if (updated) {
        console.log('  Synced hasReplied=true for:', rc.commentId, '| keyword:', rc.matchedKeyword);
        syncCount++;
      }
    }
  }
  console.log(`Synced ${syncCount} comments with hasReplied=true from RepliedComment log.\n`);

  // 4. Final state report
  const botReplies = await Comment.find({ isBotReply: true });
  const unprocessed = await Comment.find({ aiActionTaken: false });
  console.log('=== Final State ===');
  console.log('  Comments with isBotReply=true:', botReplies.length);
  console.log('  Comments with aiActionTaken=false (to be processed):', unprocessed.length);
  unprocessed.slice(0, 5).forEach(c => {
    console.log('    -', c.youtubeId, '|', c.text?.substring(0, 50), '| isBotReply:', c.isBotReply);
  });

  await mongoose.disconnect();
  console.log('\nDB migration complete!');
}

main().catch(e => { console.error('ERROR:', e.message, e.stack); process.exit(1); });
