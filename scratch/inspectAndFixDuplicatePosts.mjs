import '../config/env.mjs';
import mongoose from 'mongoose';
import Video from '../models/Video.mjs';

async function inspectPosts() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const posts = await Video.find({ isPost: true }).lean();
  console.log(`--- TOTAL COMMUNITY POSTS IN DB: ${posts.length} ---`);
  posts.forEach((p, idx) => {
    console.log(`${idx + 1}. Title: "${p.title.slice(0, 40)}" | videoId: ${p.videoId} | channelId: ${p.channelId} | userId: ${p.userId}`);
  });

  await mongoose.disconnect();
}

inspectPosts().catch(console.error);
