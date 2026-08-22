import jwt from 'jsonwebtoken';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const secret = process.env.JWT_SECRET || '9f3a8c2d91a7b6e4f0c123456789abcdef';
const token = jwt.sign({ id: '6a58b362e2ae4241d5adfa13', email: 'john@gmail.com' }, secret, { expiresIn: '1h' });

async function testLocalAuth() {
  console.log('--- Testing Local Server authMiddleware Logging ---');
  
  console.log('\n[1] Sending valid Bearer header...');
  try {
    const res1 = await axios.get('http://localhost:5000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Result 1:', res1.status, res1.data);
  } catch (err) {
    console.log('Result 1:', err.response?.status, err.response?.data);
  }

  console.log('\n[2] Sending Bearer header with extra spaces & quotes...');
  try {
    const res2 = await axios.get('http://localhost:5000/api/auth/me', {
      headers: { Authorization: `Bearer   "${token}"  ` }
    });
    console.log('Result 2:', res2.status, res2.data);
  } catch (err) {
    console.log('Result 2:', err.response?.status, err.response?.data);
  }

  console.log('\n[3] Sending missing Authorization header...');
  try {
    const res3 = await axios.get('http://localhost:5000/api/auth/me');
    console.log('Result 3:', res3.status, res3.data);
  } catch (err) {
    console.log('Result 3:', err.response?.status, err.response?.data);
  }
}

testLocalAuth();
