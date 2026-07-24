import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = 57189;
const API_URL = `http://localhost:${PORT}/api/auth/sso`;

const agent = new https.Agent({  
  rejectUnauthorized: false
});

async function test() {
  try {
    console.log(`Sending SSO request to: ${API_URL}`);
    const response = await axios.post(API_URL, {
      sso_username: 'tech@gmail.com',
      sso_key: 'ciphergate_gowhats_secure_sso_key_2024'
    }, { httpsAgent: agent });

    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.token) {
      console.log('✅ SSO authentication test PASSED!');
    } else {
      console.log('❌ SSO authentication test FAILED!');
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ SSO route error:', err.response?.data || err.message);
    process.exit(1);
  }
}

test();
