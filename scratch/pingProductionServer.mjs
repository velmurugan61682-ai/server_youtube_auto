import axios from 'axios';

async function run() {
  const urls = [
    'https://server-youtube-auto.onrender.com/api/health',
    'https://server-youtube-auto-4esx.vercel.app/api/health',
    'https://server-youtube-auto-4esx.vercel.app/api/youtube/videos'
  ];

  for (const url of urls) {
    try {
      console.log(`Checking ${url}...`);
      const res = await axios.get(url, { timeout: 5000 });
      console.log(`✅ ${url} is ONLINE. Status:`, res.status);
    } catch (e) {
      console.log(`❌ ${url} failed:`, e.response?.status || e.message);
      if (e.response?.data) {
        console.log('Response data:', JSON.stringify(e.response.data));
      }
    }
  }
}

run();
