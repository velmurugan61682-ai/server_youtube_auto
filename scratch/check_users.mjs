import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findById('6a3a6ffbb0dc909c45933e35');
    console.log('User 6a3a6ffbb0dc909c45933e35 exists:', !!user);
    if (user) {
      console.log(` - name: ${user.name}`);
      console.log(` - email: ${user.email}`);
    }

    const admin = await User.findOne({ email: 'admin@youtubeai.test' });
    console.log('Admin user exists:', !!admin);
    if (admin) {
      console.log(` - _id: ${admin._id}`);
    }

    const allUsers = await User.find();
    console.log('All Users:');
    allUsers.forEach(u => console.log(` - _id: ${u._id}, name: ${u.name}, email: ${u.email}`));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
