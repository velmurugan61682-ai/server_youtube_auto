import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const user = await db.collection('users').findOne({ email: 'techvaseegrah@gmail.com' });
    const orgId = user.organizationId;
    const userId = user._id;

    console.log(`User: ${user.email} | OrgId: ${orgId} | UserId: ${userId}`);

    const filterChannel = { $or: [{ organizationId: orgId }, { userId: userId }] };
    const channels = await db.collection('channels').find(filterChannel).toArray();
    console.log(`Channels found for user: ${channels.length} -> ${channels.map(c => c.title).join(', ')}`);

    const filterVideo = { $or: [{ organizationId: orgId }, { userId: userId }] };
    const videos = await db.collection('videos').find(filterVideo).toArray();
    console.log(`Videos found for user: ${videos.length}`);

    const filterComment = { $or: [{ organizationId: orgId }, { userId: userId }] };
    const comments = await db.collection('comments').find(filterComment).toArray();
    console.log(`Comments found for user: ${comments.length}`);

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

run();
