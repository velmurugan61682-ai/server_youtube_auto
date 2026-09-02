import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import jwt from 'jsonwebtoken';

dotenv.config({ path: path.join(process.cwd(), 'server_youtube_auto', '.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: '.env' });
}

import User from '../models/User.mjs';
import { getMe } from '../controllers/authController.mjs';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const user = await User.findOne({ email: 'velmurugan61682@gmail.com' }).lean();
  console.log('Found user in DB:', user._id.toString(), user.email);

  const token = jwt.sign({
    id: user._id.toString(),
    email: user.email,
    role: user.role || 'client',
    organizationId: user.organizationId
  }, process.env.JWT_SECRET, { expiresIn: '7d' });

  console.log('\nGenerated JWT Token:\n', token);

  // Mock req and res for getMe
  const req = {
    user: {
      id: user._id.toString(),
      email: user.email,
      role: user.role
    }
  };

  const res = {
    status: (code) => {
      console.log(`[res.status] ${code}`);
      return res;
    },
    json: (data) => {
      console.log('[res.json] Output:', JSON.stringify(data, null, 2));
      return res;
    }
  };

  console.log('\nCalling getMe(req, res)...');
  await getMe(req, res);

  await mongoose.disconnect();
}

main().catch(console.error);
