import axios from 'axios';

async function run() {
  const url = 'https://server-youtube-auto.onrender.com/api/youtube/videos';
  try {
    console.log(`Sending OPTIONS request to: ${url}`);
    const response = await axios({
      method: 'OPTIONS',
      url,
      headers: {
        'Origin': 'https://ciphergate.techvaseegrah.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type'
      }
    });

    console.log('Response Status:', response.status);
    console.log('Response Headers:');
    console.log('- access-control-allow-origin:', response.headers['access-control-allow-origin']);
    console.log('- access-control-allow-methods:', response.headers['access-control-allow-methods']);
    console.log('- access-control-allow-headers:', response.headers['access-control-allow-headers']);
    
    if (response.headers['access-control-allow-origin'] === 'https://ciphergate.techvaseegrah.com') {
      console.log('✅ CORS is successfully deployed and active for ciphergate.techvaseegrah.com!');
    } else {
      console.log('❌ CORS is NOT yet updated. Current allowed origin:', response.headers['access-control-allow-origin']);
    }
  } catch (err) {
    console.error('CORS preflight request failed:', err.message);
    if (err.response) {
      console.log('Status:', err.response.status);
      console.log('Headers:', JSON.stringify(err.response.headers, null, 2));
    }
  }
}

run();
