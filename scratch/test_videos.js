import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const run = async () => {
  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'stable_dev_secret_2026';
    const userId = '6a3a6ffbb0dc909c45933e35';
    const email = 'admin1@example.com';
    
    // Generate a valid JWT token directly
    const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '7d' });

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    const channelId = 'UCyFw6NotahbWYQnWfWc7Wmw';
    const res = await fetch(`http://localhost:5000/api/youtube/videos?channelId=${channelId}`, { headers });
    console.log('API Status:', res.status);
    const data = await res.json();
    console.log('API Data response (videos count):', data.videos?.length || 0);
    console.log('Videos:', JSON.stringify(data.videos, null, 2));

  } catch (err) {
    console.error('Error:', err);
  }
};

run();
