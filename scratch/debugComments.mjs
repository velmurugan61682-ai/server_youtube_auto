import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Comment from '../models/Comment.mjs';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.log('--- DATABASE CONNECTION DETAILS ---');
  console.log(`Host: ${mongoose.connection.host}`);
  console.log(`Database Name: ${mongoose.connection.name}`);
  
  // List all collections
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections in this Database:');
  collections.forEach(col => console.log(`  - ${col.name}`));
  
  // Count using raw MongoDB
  const rawCount = await mongoose.connection.db.collection('comments').countDocuments({});
  console.log(`\nRaw 'comments' collection count: ${rawCount}`);
  
  const rawUsersCount = await mongoose.connection.db.collection('users').countDocuments({});
  console.log(`Raw 'users' collection count: ${rawUsersCount}`);
  
  const rawChannelsCount = await mongoose.connection.db.collection('channels').countDocuments({});
  console.log(`Raw 'channels' collection count: ${rawChannelsCount}`);

  // Find one comment raw
  if (rawCount > 0) {
    const doc = await mongoose.connection.db.collection('comments').findOne({});
    console.log('\nSample raw comment document:', doc);
  }

  process.exit(0);
}

run();
