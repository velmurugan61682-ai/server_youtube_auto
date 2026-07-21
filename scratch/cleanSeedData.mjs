import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Comment from '../models/Comment.mjs';
import Lead from '../models/Lead.mjs';

await mongoose.connect(process.env.MONGODB_URI);

const allComments = await Comment.find().lean();
let deletedC = 0;
for (const c of allComments) {
  const author = c.author || '';
  const text = c.text || '';
  const yid = c.youtubeId || '';
  if (
    yid.startsWith('seed_') ||
    author.includes('Rahul') ||
    author.includes('Sneha') ||
    author.includes('Vikram') ||
    author.includes('Jane') ||
    text.includes('web developer internship') ||
    text.includes('premium course') ||
    text.includes('WhatsApp ordering system')
  ) {
    await Comment.deleteOne({ _id: c._id });
    deletedC++;
  }
}

const allLeads = await Lead.find().lean();
let deletedL = 0;
for (const l of allLeads) {
  const author = l.authorName || '';
  const comment = l.originalComment || '';
  if (
    author.includes('Rahul') ||
    author.includes('Sneha') ||
    author.includes('Vikram') ||
    author.includes('Jane') ||
    comment.includes('web developer internship') ||
    comment.includes('premium course') ||
    comment.includes('WhatsApp ordering system')
  ) {
    await Lead.deleteOne({ _id: l._id });
    deletedL++;
  }
}

console.log(`✅ Deleted ${deletedC} dummy seed comments.`);
console.log(`✅ Deleted ${deletedL} dummy seed leads.`);

const finalComments = await Comment.countDocuments();
const finalLeads = await Lead.countDocuments();

console.log(`Remaining comments in DB: ${finalComments}`);
console.log(`Remaining leads in DB: ${finalLeads}`);

process.exit(0);
