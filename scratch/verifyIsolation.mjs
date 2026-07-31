import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const checkEmails = [
      'techvaseegrah@gmail.com',
      'techvaseegrah@ciphergate.in',
      'channelmate@gmail.com',
      'velmurugan61682@gmail.com',
      'velmurugan@gmail.com'
    ];

    console.log('=== DATA ACCESS ISOLATION VERIFICATION ===\n');
    for (const email of checkEmails) {
      const user = await db.collection('users').findOne({ email });
      if (!user) {
        console.log(`User: ${email} -> NOT FOUND`);
        continue;
      }

      const filterChannel = { $or: [{ organizationId: user.organizationId }, { userId: user._id }] };
      const channels = await db.collection('channels').find(filterChannel).toArray();

      const filterVideo = { $or: [{ organizationId: user.organizationId }, { userId: user._id }] };
      const videos = await db.collection('videos').find(filterVideo).toArray();

      console.log(`User: ${user.email} (Org: ${user.organizationId})`);
      console.log(` -> Channels Accessible: ${channels.length} [${channels.map(c => c.title).join(', ')}]`);
      console.log(` -> Videos Accessible: ${videos.length}`);
      console.log('----------------------------------------------------');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
