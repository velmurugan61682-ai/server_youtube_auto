import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.mjs';
import bcrypt from 'bcryptjs';

dotenv.config();

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const email = process.env.ADMIN_RESET_EMAIL || 'admin@youtubeai.test';
    const resetPassword = process.env.ADMIN_RESET_PASSWORD;
    if (!resetPassword) {
      throw new Error('ADMIN_RESET_PASSWORD is required to reset an admin password');
    }
    const hashedPassword = await bcrypt.hash(resetPassword, 10);
    
    await User.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { upsert: true, returnDocument: 'after' }
    );
    
    console.log('Admin password reset successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

test();
