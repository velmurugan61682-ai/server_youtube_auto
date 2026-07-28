import axios from 'axios';

async function testSso() {
  const baseUrl = 'http://localhost:5000/api/auth/sso';

  console.log('--- 1. Testing Invalid SSO Key ---');
  try {
    const res = await axios.post(baseUrl, {
      sso_username: 'test_ciphergate_user@ciphergate.in',
      sso_key: 'wrong_key'
    });
    console.log('Result:', res.data);
  } catch (err) {
    console.log('✅ Correctly Rejected Invalid SSO Key:', err.response?.status, err.response?.data);
  }

  console.log('\n--- 2. Testing Valid SSO Key (GET request) ---');
  try {
    const res = await axios.get(`${baseUrl}?sso_username=ciphergate_user&sso_key=ciphergate_gowhats_secure_sso_key_2024&embed=true&hide_shell=true&redirect=videos`);
    console.log('✅ SSO Login Success:', res.data);
  } catch (err) {
    console.log('Error:', err.response?.status, err.response?.data || err.message);
  }

  console.log('\n--- 3. Testing Valid SSO Key (POST request) ---');
  try {
    const res = await axios.post(baseUrl, {
      sso_username: 'ciphergate_admin@ciphergate.in',
      sso_key: 'ciphergate_gowhats_secure_sso_key_2024',
      role: 'admin',
      redirect: 'videos',
      embed: 'true',
      hide_shell: 'true'
    });
    console.log('✅ SSO Login Success:', res.data);
  } catch (err) {
    console.log('Error:', err.response?.status, err.response?.data || err.message);
  }
}

testSso().catch(console.error);
