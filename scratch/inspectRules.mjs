import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CommentAutomationRule from '../models/CommentAutomationRule.mjs';
import AutoReplyRule from '../models/AutoReplyRule.mjs';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.log('--- COMMENT AUTOMATION RULES (commentautomationrules) ---');
  const car = await CommentAutomationRule.find({}).lean();
  console.log(`Count: ${car.length}`);
  car.forEach((r, i) => {
    console.log(`\nRule ${i + 1}:`);
    console.log(JSON.stringify(r, null, 2));
  });
  
  console.log('\n--- AUTO REPLY RULES (autoreplyrules) ---');
  const arr = await AutoReplyRule.find({}).lean();
  console.log(`Count: ${arr.length}`);
  arr.forEach((r, i) => {
    console.log(`\nRule ${i + 1}:`);
    console.log(JSON.stringify(r, null, 2));
  });
  
  process.exit(0);
}

run();
