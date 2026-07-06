import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import dotenv from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import mongoose from 'mongoose';
import AutoDmConfig from '../models/AutoDmConfig.js';
import Comment from '../models/Comment.mjs';
import Channel from '../models/Channel.mjs';

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected!');

  // Check AutoDmConfig for video 5vBY8Jj5Wds
  const config = await AutoDmConfig.findOne({ videoId: '5vBY8Jj5Wds' });
  if (config) {
    console.log('\n=== AutoDmConfig for 5vBY8Jj5Wds ===');
    console.log('keywords:', JSON.stringify(config.keywords));
    console.log('enabled:', config.enabled);
    console.log('whatsappNumber:', config.whatsappNumber);
    console.log('replyTemplates:', JSON.stringify(config.replyTemplates));
  } else {
    console.log('\nNo AutoDmConfig found for video 5vBY8Jj5Wds');
  }

  // Check all AutoDmConfig
  const allConfigs = await AutoDmConfig.find({});
  console.log('\n=== All AutoDmConfigs ===');
  allConfigs.forEach(c => console.log('  videoId:', c.videoId, '| enabled:', c.enabled, '| keywords:', JSON.stringify(c.keywords)));

  // Check bot comments
  const botComments = await Comment.find({ videoId: '5vBY8Jj5Wds', isBotReply: true }).sort({ publishedAt: -1 }).limit(5);
  console.log('\n=== Bot comments (isBotReply=true) for 5vBY8Jj5Wds ===');
  if (botComments.length === 0) console.log('  None found.');
  botComments.forEach(c => {
    console.log('  id:', c.youtubeId, '| text:', (c.text || '').substring(0, 80));
    console.log('    aiActionTaken:', c.aiActionTaken, '| classification:', c.classification, '| status:', c.status);
    console.log('    moderationStatus:', c.moderationStatus, '| isBotReply:', c.isBotReply);
  });

  // Check unprocessed comments
  const unprocessed = await Comment.find({ videoId: '5vBY8Jj5Wds', aiActionTaken: false }).sort({ publishedAt: -1 }).limit(10);
  console.log('\n=== Unprocessed (aiActionTaken=false) comments for 5vBY8Jj5Wds ===');
  if (unprocessed.length === 0) console.log('  None found.');
  unprocessed.forEach(c => {
    console.log('  id:', c.youtubeId, '| isBotReply:', c.isBotReply, '| hasReplied:', c.hasReplied, '| aiStatus:', c.aiStatus);
    console.log('    text:', (c.text || '').substring(0, 60));
    console.log('    replyStatus:', c.replyStatus, '| status:', c.status);
  });

  // Check channel
  const channels = await Channel.find({});
  console.log('\n=== Channels ===');
  channels.forEach(ch => console.log('  channelId:', ch.channelId, '| title:', ch.title, '| reconnectRequired:', ch.reconnectRequired));

  await mongoose.disconnect();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
