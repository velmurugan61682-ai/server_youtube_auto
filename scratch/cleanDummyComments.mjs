import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Comment from '../models/Comment.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import Channel from '../models/Channel.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function inspectAndClean() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const dummyComments = await Comment.find({
      $or: [
        { text: /dummy comment/i },
        { commentText: /dummy comment/i },
        { text: 'Dummy comment text' },
        { author: 'Anonymous', text: /dummy/i }
      ]
    }).lean();

    console.log(`Found ${dummyComments.length} dummy comments matching pattern.`);
    for (const d of dummyComments) {
      console.log(`Deleting comment ID: ${d._id}, Channel: ${d.channelId}, Text: ${d.text}`);
      await Comment.deleteOne({ _id: d._id });
    }

    // Also check for orphan comments whose channelId does not belong to any connected Channel
    const connectedChannels = await Channel.find().select('channelId').lean();
    const connectedChannelIds = connectedChannels.map(c => c.channelId);

    const orphanComments = await Comment.find({
      channelId: { $nin: connectedChannelIds }
    }).lean();

    console.log(`Found ${orphanComments.length} orphan comments for disconnected channels.`);
    for (const o of orphanComments) {
      console.log(`Deleting orphan comment ID: ${o._id}, Channel: ${o.channelId}, Text: ${o.text}`);
      await Comment.deleteOne({ _id: o._id });
    }

    console.log('Cleanup complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
}

inspectAndClean();
