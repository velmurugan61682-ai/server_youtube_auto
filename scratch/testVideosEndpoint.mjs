import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import Video from '../models/Video.mjs';

dotenv.config();

const testGetVideos = async (userEmail) => {
  const user = await User.findOne({ email: userEmail });
  if (!user) {
    console.log(`User ${userEmail} not found`);
    return;
  }

  const req = {
    user: { id: user._id.toString(), organizationId: user.organizationId ? user.organizationId.toString() : null },
    query: { channelId: 'UCdpaYm53cdH0SODoBXAKRmQ' }
  };

  const channelId = req.query.channelId;

  const filterChannel = req.user.organizationId
    ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }], channelId }
    : { userId: req.user.id, channelId };

  const channel = await Channel.findOne(filterChannel).lean();
  if (!channel) {
    console.log(`User ${userEmail} -> 404 Channel not found`);
    return;
  }

  const filterUser = req.user.organizationId
    ? { $or: [{ organizationId: req.user.organizationId }, { _id: req.user.id }] }
    : { _id: req.user.id };
  const users = await User.find(filterUser).select('_id').lean();
  const userIds = users.map(u => u._id);

  const videos = await Video.find({
    channelId,
    $or: [{ userId: { $in: userIds } }, { organizationId: channel.organizationId }]
  }).sort({ publishedAt: -1 }).lean();

  console.log(`SUCCESS 200 OK for User ${userEmail}: Channel found '${channel.title}', Videos count: ${videos.length}`);
};

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- TESTING GET /api/youtube/videos LOGIC ---');
    await testGetVideos('techvaseegrah@gmail.com');
    await testGetVideos('techvaseegrah@ciphergate.in');
    await testGetVideos('tech@gmail.com');
    await testGetVideos('velmurugan61682@gmail.com');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
