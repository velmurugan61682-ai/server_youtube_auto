import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Comment from '../models/Comment.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const totalCount = await Comment.countDocuments({ userId: '6a3a6ffbb0dc909c45933e35' });
    console.log('Total comments for userId 6a3a6ffbb0dc909c45933e35:', totalCount);

    const pendingCount = await Comment.countDocuments({ userId: '6a3a6ffbb0dc909c45933e35', aiActionTaken: false });
    console.log('Pending comments for userId 6a3a6ffbb0dc909c45933e35:', pendingCount);

    const completedCount = await Comment.countDocuments({ userId: '6a3a6ffbb0dc909c45933e35', aiActionTaken: true });
    console.log('Completed comments for userId 6a3a6ffbb0dc909c45933e35:', completedCount);

    if (totalCount > 0) {
      console.log('\nSample comments:');
      const samples = await Comment.find({ userId: '6a3a6ffbb0dc909c45933e35' }).limit(10);
      samples.forEach(c => {
        console.log(` - ID: ${c.youtubeId}, Text: "${c.text}", aiActionTaken: ${c.aiActionTaken}, aiStatus: ${c.aiStatus}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
