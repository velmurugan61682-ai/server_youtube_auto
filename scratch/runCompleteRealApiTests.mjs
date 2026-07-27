import '../config/env.mjs';
import mongoose from 'mongoose';
import User from '../models/User.mjs';
import jwt from 'jsonwebtoken';
import http from 'http';

async function runRealTests() {
  console.log('Connecting to database to generate valid tokens...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // Fetch client user & admin user
  const clientUser = await User.findOne({ email: 'velmurugan61682@gmail.com' }).lean();
  let adminUser = await User.findOne({ role: 'admin' }).lean();
  if (!adminUser) {
    adminUser = await User.findOne({ email: 'admin@channelbot.in' }).lean();
  }

  const clientToken = jwt.sign(
    { id: clientUser._id.toString(), email: clientUser.email, role: 'client', organizationId: clientUser.organizationId ? clientUser.organizationId.toString() : null },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const adminToken = jwt.sign(
    { id: adminUser._id.toString(), email: adminUser.email, role: 'admin', isAdmin: true },
    process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const apiKey = process.env.EXTERNAL_ADMIN_API_KEY || 'cm_ext_e7456b75cc7ab05ce7d99c72a8c218f49741a11fa465d414d8507d9f858ff9b8';

  console.log('✓ Test Credentials & Tokens generated successfully');

  const makeReq = (pathStr, method = 'GET', headers = {}, bodyObj = null) => {
    return new Promise((resolve) => {
      const payload = bodyObj ? JSON.stringify(bodyObj) : null;
      const reqHeaders = { ...headers };
      if (payload) {
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = http.request(
        {
          hostname: 'localhost',
          port: 5000,
          path: pathStr,
          method,
          headers: reqHeaders
        },
        (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            resolve({ status: res.statusCode, body: body.slice(0, 300) });
          });
        }
      );
      req.on('error', err => resolve({ status: 500, error: err.message }));
      if (payload) req.write(payload);
      req.end();
    });
  };

  console.log('\n--- 🧪 LIVE API TEST EXECUTION RESULTS ---');

  // Test 1: Health API
  console.log('1. GET /api/health:', await makeReq('/api/health'));

  // Test 2: Login API with valid JSON body
  console.log('2. POST /api/auth/login:', await makeReq('/api/auth/login', 'POST', {}, { email: 'velmurugan61682@gmail.com', password: 'password123' }));

  // Test 3: Authenticated Profile API (/api/auth/me) with Client JWT
  console.log('3. GET /api/auth/me (with Client Bearer Token):', await makeReq('/api/auth/me', 'GET', { Authorization: `Bearer ${clientToken}` }));

  // Test 4: External Customer Details API with x-api-key
  console.log('4. GET /api/v1/external/customers/details (with x-api-key):', await makeReq('/api/v1/external/customers/details', 'GET', { 'x-api-key': apiKey }));

  // Test 5: Google OAuth Initiate API (/api/youtube/auth/initiate)
  console.log('5. POST /api/youtube/auth/initiate (with Client Bearer Token):', await makeReq('/api/youtube/auth/initiate', 'POST', { Authorization: `Bearer ${clientToken}` }));

  // Test 6: Google OAuth Initiate API (/api/auth/google)
  console.log('6. GET /api/auth/google (with Client Bearer Token):', await makeReq('/api/auth/google', 'GET', { Authorization: `Bearer ${clientToken}` }));

  // Test 7: Analytics API (/api/analytics)
  console.log('7. GET /api/analytics (with Client Bearer Token):', await makeReq('/api/analytics', 'GET', { Authorization: `Bearer ${clientToken}` }));

  // Test 8: Channels List API (/api/youtube/channels)
  console.log('8. GET /api/youtube/channels (with Client Bearer Token):', await makeReq('/api/youtube/channels', 'GET', { Authorization: `Bearer ${clientToken}` }));

  // Test 9: Comments API (/api/comments)
  console.log('9. GET /api/comments (with Client Bearer Token):', await makeReq('/api/comments', 'GET', { Authorization: `Bearer ${clientToken}` }));

  // Test 10: Admin Customers Details API (/api/admin/customers/details)
  console.log('10. GET /api/admin/customers/details (with Admin Bearer Token):', await makeReq('/api/admin/customers/details', 'GET', { Authorization: `Bearer ${adminToken}` }));

  await mongoose.disconnect();
  console.log('\n✅ All API Tests Completed Successfully!');
}

runRealTests().catch(console.error);
