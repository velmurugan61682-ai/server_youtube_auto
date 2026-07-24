import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to Database');

    const user = await User.findOne({ email: 'tech@gmail.com' }).lean();
    if (!user) {
      console.log('User not found!');
      process.exit(1);
    }

    console.log('User details:');
    console.log('- Name:', user.name);
    console.log('- Email:', user.email);
    console.log('- ProfilePicture length:', user.profilePicture ? user.profilePicture.length : 0);
    if (user.profilePicture) {
      console.log('- ProfilePicture prefix:', user.profilePicture.substring(0, 100));
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
