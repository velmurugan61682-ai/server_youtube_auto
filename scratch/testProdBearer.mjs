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

async function testBearerVariations() {
  console.log('=== Testing Production Server (Render) Bearer Variations ===\n');

  const variations = [
    { name: '1. Standard Bearer', header: `Bearer ${token}` },
    { name: '2. Bearer with tabs/spaces', header: `Bearer \t  ${token}` },
    { name: '3. Lowercase bearer', header: `bearer ${token}` },
    { name: '4. Bearer with quotes', header: `Bearer "${token}"` },
    { name: '5. Missing Authorization header', header: undefined },
    { name: '6. Bearer null string', header: 'Bearer null' },
    { name: '7. Bearer empty space', header: 'Bearer  ' }
  ];

  for (const v of variations) {
    try {
      const headers = v.header !== undefined ? { Authorization: v.header } : {};
      const res = await axios.get('https://server-youtube-auto.onrender.com/api/auth/me', { headers });
      console.log(`✅ [${v.name}] HTTP ${res.status}:`, res.data);
    } catch (err) {
      console.log(`❌ [${v.name}] HTTP ${err.response?.status}:`, err.response?.data);
    }
  }
}

testBearerVariations();
