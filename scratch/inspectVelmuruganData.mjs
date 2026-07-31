import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const targetEmails = [
      'velmurugan@gmail.com',
      'velmurugan61682@gmail.com',
      'john@gmail.com',
      'channelmate@gmail.com'
    ];

    const users = await db.collection('users').find({ email: { $in: targetEmails } }).toArray();
    console.log('=== TARGET USERS ===');
    users.forEach(u => console.log(`User: ${u.email} | ID: ${u._id} | Org: ${u.organizationId}`));

    const userIds = users.map(u => u._id);

    const userChannels = await db.collection('channels').find({ userId: { $in: userIds } }).toArray();
    console.log(`\nChannels owned by target users (${userChannels.length}):`);
    userChannels.forEach(c => console.log(` - Channel: ${c.title} (ID: ${c.channelId}, User: ${c.userId})`));

    const userVideos = await db.collection('videos').find({ userId: { $in: userIds } }).toArray();
    console.log(`\nVideos owned by target users (${userVideos.length}):`);
    userVideos.forEach(v => console.log(` - Video: ${v.title} (ID: ${v.videoId}, User: ${v.userId})`));

    const userComments = await db.collection('comments').find({ userId: { $in: userIds } }).toArray();
    console.log(`\nComments owned by target users (${userComments.length}):`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
