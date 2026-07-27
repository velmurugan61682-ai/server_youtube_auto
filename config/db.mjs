import mongoose from 'mongoose';
import dns from 'dns';
import logger from '../utils/logger.mjs';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

export const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    logger.error('❌ MONGODB_URI is missing!');
    process.exit(1);
  }

  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        family: 4
      });
      logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
      
      // Index migration check
      const db = mongoose.connection.db;
      const commentIndexes = await db.collection('comments').indexes();
      if (commentIndexes.some(idx => idx.name === 'youtubeId_1')) {
        await db.collection('comments').dropIndex('youtubeId_1');
        logger.info('Dropped old single-field unique index: comments.youtubeId_1');
      }
      
      const channelIndexes = await db.collection('channels').indexes();
      if (channelIndexes.some(idx => idx.name === 'channelId_1')) {
        await db.collection('channels').dropIndex('channelId_1');
        logger.info('Dropped old single-field unique index: channels.channelId_1');
      }
      return conn;
    } catch (error) {
      logger.error(`❌ MongoDB Connection Error (Attempt ${attempt}/${maxRetries}): ${error.message}`);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } else {
        process.exit(1);
      }
    }
  }
};

