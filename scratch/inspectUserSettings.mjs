import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.mjs';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const user = await User.findOne({ email: 'ChannelBot@gmail.com' }).lean();
  console.log('--- USER SETTINGS ---');
  console.log(JSON.stringify(user.settings, null, 2));

  process.exit(0);
}

run();
