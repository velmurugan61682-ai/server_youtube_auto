import '../config/env.mjs';
import mongoose from 'mongoose';
import Comment from '../models/Comment.mjs';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const langs = await Comment.aggregate([{ $group: { _id: '$language', count: { $sum: 1 } } }]);
  const cats = await Comment.aggregate([{ $group: { _id: '$classification', count: { $sum: 1 } } }]);
  const sentiments = await Comment.aggregate([{ $group: { _id: '$sentiment', count: { $sum: 1 } } }]);
  console.log('Distinct languages in DB:', JSON.stringify(langs, null, 2));
  console.log('Distinct classifications in DB:', JSON.stringify(cats, null, 2));
  console.log('Distinct sentiments in DB:', JSON.stringify(sentiments, null, 2));
  process.exit(0);
}

check();
