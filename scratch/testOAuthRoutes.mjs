import '../config/env.mjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.mjs';
import jwt from 'jsonwebtoken';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testOAuthRoutes() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const user = await User.findOne({ email: 'velmurugan61682@gmail.com' }).lean();
  const token = jwt.sign(
    { id: user._id.toString(), email: user.email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const makeReq = (pathStr, method = 'GET') => {
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: 'localhost',
          port: 5000,
          path: pathStr,
          method,
          headers: {
            Authorization: `Bearer ${token}`
          }
        },
        (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            resolve({ status: res.statusCode, body });
          });
        }
      );
      req.on('error', err => resolve({ status: 500, error: err.message }));
      req.end();
    });
  };

  console.log('Testing GET /api/auth/google:', await makeReq('/api/auth/google'));
  console.log('Testing GET /api/youtube/connect:', await makeReq('/api/youtube/connect'));
  console.log('Testing POST /api/youtube/auth/initiate:', await makeReq('/api/youtube/auth/initiate', 'POST'));

  await mongoose.disconnect();
}

testOAuthRoutes().catch(console.error);
