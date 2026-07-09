import '../config/env.mjs';
import mongoose from 'mongoose';
import Comment from '../models/Comment.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import logger from '../utils/logger.mjs';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  logger.info('Connected to MongoDB.');

  const videoId = '5vBY8Jj5Wds';
  
  // Find comments for this video
  const comments = await Comment.find({ videoId });
  logger.info(`Found ${comments.length} comments in database for video ${videoId}:`);
  for (const c of comments) {
    logger.info(`- ID: ${c.youtubeId} | Author: ${c.author} | Text: "${c.text}"`);
    logger.info(`  Status: ${c.status} | replyStatus: ${c.replyStatus} | replyText: "${c.replyText}" | isBotReply: ${c.isBotReply} | hasReplied: ${c.hasReplied}`);
  }

  // Find logs
  const logs = await AutoReplyLog.find({ videoId });
  logger.info(`Found ${logs.length} AutoReplyLog entries:`);
  for (const l of logs) {
    logger.info(`- CommentId: ${l.commentId} | Status: ${l.status} | replyText: "${l.replyText}"`);
  }

  process.exit(0);
}

main();
