import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '../.env')
});

// Map legacy variables for backward compatibility
if (process.env.YOUTUBE_OAUTH_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID) {
  process.env.GOOGLE_CLIENT_ID = process.env.YOUTUBE_OAUTH_CLIENT_ID;
}
if (process.env.YOUTUBE_OAUTH_CLIENT_SECRET && !process.env.GOOGLE_CLIENT_SECRET) {
  process.env.GOOGLE_CLIENT_SECRET = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
}
if (process.env.MONGO_URI && !process.env.MONGODB_URI) {
  process.env.MONGODB_URI = process.env.MONGO_URI;
}

// Automatically configure GOOGLE_REDIRECT_URI if not defined
if (!process.env.GOOGLE_REDIRECT_URI) {
  const isProduction = process.env.NODE_ENV === 'production';
  process.env.GOOGLE_REDIRECT_URI = isProduction
    ? (process.env.GOOGLE_REDIRECT_URI_PROD || '')
    : (process.env.GOOGLE_REDIRECT_URI_DEV || 'http://localhost:5000/api/youtube/callback');
}

console.log('✅ Environment loaded and mapped from env.mjs');
