import axios from 'axios';
import https from 'https';

const agent = new https.Agent({  
  rejectUnauthorized: false
});

async function run() {
  try {
    const res1 = await axios.get('http://localhost:57189/');
    console.log('--- http://localhost:57189/ ---');
    console.log('Status:', res1.status);
    console.log('Data:', typeof res1.data === 'object' ? JSON.stringify(res1.data) : res1.data.substring(0, 200));
  } catch (e) {
    console.error('http://localhost:57189/ failed:', e.message);
  }

  try {
    const res2 = await axios.get('https://localhost:57199/api/health', { httpsAgent: agent });
    console.log('--- https://localhost:57199/api/health ---');
    console.log('Status:', res2.status);
    console.log('Data:', JSON.stringify(res2.data));
  } catch (e) {
    console.error('https://localhost:57199/api/health failed:', e.message);
  }
}

run();
