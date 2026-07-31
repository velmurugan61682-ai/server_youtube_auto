import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    // Simulate getConnectedChannels for tech@gmail.com
    const user = await db.collection('users').findOne({ email: 'tech@gmail.com' });
    console.log('tech@gmail.com User:');
    console.log(' - _id:', user._id);
    console.log(' - organizationId:', user.organizationId);

    const filter = user.organizationId
      ? { $or: [{ organizationId: user.organizationId }, { userId: user._id }] }
      : { userId: user._id };

    const channels = await db.collection('channels').find(filter).toArray();
    console.log('\nChannels returned for tech@gmail.com with org-aware query:', channels.length);
    channels.forEach(c => {
      console.log(` - Channel: ${c.title} (${c.channelId}) | userId: ${c.userId} | orgId: ${c.organizationId}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
