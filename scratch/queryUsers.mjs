import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'server_youtube_auto', '.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: '.env' });
}

import User from '../models/User.mjs';

async function main() {
  const uri = process.env.MONGODB_URI;
  console.log(`Connecting to MongoDB at: ${uri ? uri.replace(/:([^@]+)@/, ':****@') : 'UNDEFINED'}`);
  await mongoose.connect(uri);
  console.log('Connected to MongoDB successfully!');

  const users = await User.find({}).lean();
  console.log(`\n=== TOTAL USERS IN DB: ${users.length} ===\n`);
  users.forEach((u, i) => {
    console.log(`[User ${i + 1}]`);
    console.log(`  _id: "${u._id}"`);
    console.log(`  name: "${u.name}"`);
    console.log(`  email: "${u.email}"`);
    console.log(`  role: "${u.role}"`);
    console.log(`  organizationId: "${u.organizationId}"`);
    console.log(`  profilePicture: "${u.profilePicture}"`);
    console.log(`  createdAt: "${u.createdAt}"`);
    console.log('---------------------------------------------------');
  });

  await mongoose.disconnect();
}

main().catch(console.error);
