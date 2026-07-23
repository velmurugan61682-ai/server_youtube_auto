import axios from 'axios';
import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:5000/api';

async function verifyStatsRoute() {
  console.log('🧪 Starting /admin/moderation/stats Route Verification...\n');

  try {
    // 1. Test standard client token rejection
    console.log('1. Testing access with a standard Client Token...');
    const clientToken = jwt.sign({ id: 'fake_client_123', role: 'client' }, '9f3a8c2d91a7b6e4f0c123456789abcdef'); // signed with JWT_SECRET
    try {
      await axios.get(`${BASE_URL}/admin/moderation/stats`, {
        headers: { Authorization: `Bearer ${clientToken}` }
      });
      console.error('❌ SECURITY FAILURE: Access allowed with client token!');
    } catch (err) {
      console.log('✅ SECURITY PASSED: Access correctly denied to client token. Status:', err.response?.status);
    }

    // 2. Login as Superadmin to get valid admin token
    console.log('\n2. Logging in as Admin...');
    const loginRes = await axios.post(`${BASE_URL}/admin/login`, {
      email: 'admin@channelmate.ai',
      password: 'AdminPass@123'
    });
    const adminToken = loginRes.data.token;
    console.log('✅ Login successful, token acquired.');

    // 3. Test access with valid admin token
    console.log('\n3. Testing access with valid Admin Token...');
    try {
      const statsRes = await axios.get(`${BASE_URL}/admin/moderation/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log('✅ SUCCESS: Admin moderation stats retrieved successfully!');
      console.log('Stats Response Data Summary:', {
        success: statsRes.data.success,
        summary: statsRes.data.summary,
        categoryBreakdown: statsRes.data.categoryBreakdown,
        perOrgStats: statsRes.data.perOrgStats
      });
    } catch (err) {
      console.error('❌ FAILURE: Admin token was rejected or stats retrieval failed!', err.response?.data || err.message);
    }

  } catch (globalErr) {
    console.error('❌ Global error in verify script:', globalErr.message);
  }
}

verifyStatsRoute();
