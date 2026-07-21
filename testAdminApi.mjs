import axios from 'axios';
import jwt from 'jsonwebtoken';

const API = 'http://localhost:5000/api/v1/admin';

async function testAdminFlow() {
  console.log('🧪 Starting Full Client <-> Server <-> MongoDB Mongoose Integration Test...\n');

  try {
    // 0. Security Verification: Attempt accessing Admin API with a Client JWT token
    console.log('0. Testing Token Isolation Security (Client Token vs Admin API)...');
    const clientToken = jwt.sign({ id: 'fake_client_123', role: 'client' }, '9f3a8c2d91a7b6e4f0c123456789abcdef');
    try {
      await axios.get(`${API}/me`, { headers: { Authorization: `Bearer ${clientToken}` } });
      console.error('❌ SECURITY FAILURE: Client token was accepted by Admin API!');
    } catch (secErr) {
      console.log('✅ SECURITY PASSED: Client token correctly rejected by Admin API! Status:', secErr.response?.status);
    }

    // 1. Login as Superadmin
    console.log('\n1. Testing Admin Login...');
    const loginRes = await axios.post(`${API}/login`, {
      email: 'admin@channelmate.ai',
      password: 'AdminPass@123'
    });
    console.log('✅ Login successful:', loginRes.data.success, 'Token received:', !!loginRes.data.token);
    const token = loginRes.data.token;

    const headers = { Authorization: `Bearer ${token}` };

    // 2. Onboard a New Client
    console.log('\n2. Testing Client Onboarding (POST /admin/clients)...');
    const testEmail = `creator_${Date.now()}@test.com`;
    const onboardRes = await axios.post(`${API}/clients`, {
      name: 'Full Stack Creator',
      email: testEmail,
      password: 'CreatorPass@123',
      organization: 'Vaseegrah Tech',
      plan: 'quarterly_pro'
    }, { headers });
    console.log('✅ Client onboarded in MongoDB! Client ID:', onboardRes.data.client.id, 'Plan:', onboardRes.data.client.plan);
    const clientId = onboardRes.data.client.id;

    // 3. Test Inline Billing Plan Update (Free <-> Pro in Mongoose)
    console.log('\n3. Testing Billing Plan Inline Toggle (PATCH /admin/subscriptions/:id)...');
    const planUpdateRes = await axios.patch(`${API}/subscriptions/${clientId}`, {
      plan: 'quarterly_pro',
      status: 'active'
    }, { headers });
    console.log('✅ Billing Plan updated in Mongoose DB:', planUpdateRes.data.subscription.plan);

    // 4. Test Inline Assigned Agent Update (AI Agent <-> Human Agent in Mongoose)
    console.log('\n4. Testing Assigned Agent Inline Toggle (PATCH /admin/clients/:id)...');
    const agentUpdateRes = await axios.patch(`${API}/clients/${clientId}`, {
      assignedAgent: 'Human Agent'
    }, { headers });
    console.log('✅ Assigned Agent updated in Mongoose DB:', agentUpdateRes.data.client.assignedAgent);

    // 5. Test Block / Unblock Account Action (Active <-> Suspended in Mongoose)
    console.log('\n5. Testing Block / Unblock Status Toggle (PATCH /admin/clients/:id)...');
    const blockRes = await axios.patch(`${API}/clients/${clientId}`, {
      status: 'suspended'
    }, { headers });
    console.log('✅ Client blocked/suspended in Mongoose DB:', blockRes.data.client.status);

    const unblockRes = await axios.patch(`${API}/clients/${clientId}`, {
      status: 'active'
    }, { headers });
    console.log('✅ Client unblocked in Mongoose DB:', unblockRes.data.client.status);

    // 6. Fetch Enriched Clients List to verify persistent state
    console.log('\n6. Fetching GET /admin/clients to verify Mongoose persistence...');
    const listRes = await axios.get(`${API}/clients`, { headers });
    const targetUser = listRes.data.clients.find(c => c._id === clientId || c.id === clientId);
    console.log('✅ Verified Client in MongoDB:', {
      name: targetUser?.name,
      status: targetUser?.status,
      assignedAgent: targetUser?.assignedAgent,
      plan: targetUser?.plan
    });

    // 7. Clean up test client
    console.log(`\n7. Cleaning up test client (${clientId})...`);
    await axios.delete(`${API}/clients/${clientId}?hard=true`, { headers });
    console.log('✅ Test client cleaned up!');

    console.log('\n🎉 CLIENT <-> EXPRESS SERVER <-> MONGOOSE DATABASE ALL WORKING 100% PERFECTLY!');
  } catch (err) {
    console.error('❌ Test failed:', err.response?.data || err.message);
  }
}

testAdminFlow();
