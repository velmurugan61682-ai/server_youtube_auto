import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const duplicates = await db.collection('videos').aggregate([
    {
      $group: {
        _id: { channelId: "$channelId", videoId: "$videoId" },
        count: { $sum: 1 },
        docs: { $push: "$_id" }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  console.log(`Found ${duplicates.length} duplicate video groups.`);

  for (const dup of duplicates) {
    console.log(`Duplicate channelId: ${dup._id.channelId}, videoId: ${dup._id.videoId}, count: ${dup.count}`);
    // keep first, delete remaining
    const [keep, ...remove] = dup.docs;
    await db.collection('videos').deleteMany({ _id: { $in: remove } });
    console.log(`Deleted ${remove.length} duplicate docs for video ${dup._id.videoId}`);
  }

  process.exit(0);
};

run().catch(e => { console.error(e); process.exit(1); });
