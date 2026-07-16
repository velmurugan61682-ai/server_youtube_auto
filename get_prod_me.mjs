import jwt from 'jsonwebtoken';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const jwtSecret = process.env.JWT_SECRET || '9f3a8c2d91a7b6e4f0c123456789abcdef';
const userId = '6a58b362e2ae4241d5adfa13'; // john's ID
const email = 'john@gmail.com';

const token = jwt.sign(
  { id: userId, email },
  jwtSecret,
  { expiresIn: '7d' }
);

async function getMe() {
  try {
    const res = await axios.get(
      'https://server-youtube-auto.onrender.com/api/auth/me',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    console.log('User Profile from Production DB:', res.data);
  } catch (err) {
    console.error('Failed to fetch profile:', err.response?.status, err.response?.data || err.message);
  }
}

getMe();
