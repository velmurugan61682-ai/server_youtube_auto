import '../config/env.mjs';
import mongoose from 'mongoose';
import Comment from '../models/Comment.mjs';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const comments = await Comment.find({}).select('createdAt publishedAt language classification sentiment text').lean();
  console.log('Total comments in DB:', comments.length);
  comments.slice(0, 10).forEach((c, i) => {
    console.log(`[${i}] createdAt: ${c.createdAt}, publishedAt: ${c.publishedAt}, lang: ${c.language}, class: ${c.classification}, text: "${c.text?.substring(0, 30)}"`);
  });

  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  console.log('Date range start:', start.toISOString(), 'end:', now.toISOString());

  const matchingWindow = comments.filter(c => {
    const pub = c.publishedAt ? new Date(c.publishedAt) : null;
    const cre = c.createdAt ? new Date(c.createdAt) : null;
    const pubIn = pub && pub >= start && pub <= now;
    const creIn = cre && cre >= start && cre <= now;
    return pubIn || creIn;
  });

  console.log('Comments matching date window:', matchingWindow.length);
  process.exit(0);
}

check();
