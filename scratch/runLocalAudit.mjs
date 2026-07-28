import '../config/env.mjs';
import express from 'express';
import routes from '../routes/index.mjs';
import mongoose from 'mongoose';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());
app.use('/api', routes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

async function runLocalAudit() {
  await mongoose.connect(process.env.MONGODB_URI);
  const server = app.listen(5050, async () => {
    console.log('✅ Local Audit Server running on port 5050');
    const baseUrl = 'http://127.0.0.1:5050/api';

    // 1. Login to get JWT
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'Password@123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log(`🔑 Login Result: ${loginRes.status} | Token: ${!!token}`);

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Test 1: GET /api/analytics/sentiment-breakdown
    const r1 = await fetch(`${baseUrl}/analytics/sentiment-breakdown`, { headers });
    console.log(`1. GET /api/analytics/sentiment-breakdown -> ${r1.status}:`, await r1.json());

    // Test 2: GET /api/analytics/overview
    const r2 = await fetch(`${baseUrl}/analytics/overview`, { headers });
    console.log(`2. GET /api/analytics/overview -> ${r2.status}:`, await r2.json());

    // Test 3: POST /api/automation/trigger-sync
    const r3 = await fetch(`${baseUrl}/automation/trigger-sync`, { method: 'POST', headers });
    console.log(`3. POST /api/automation/trigger-sync -> ${r3.status}:`, await r3.json());

    // Test 4: GET & PUT /api/automation/settings
    const r4a = await fetch(`${baseUrl}/automation/settings`, { headers });
    console.log(`4a. GET /api/automation/settings -> ${r4a.status}:`, await r4a.json());

    const r4b = await fetch(`${baseUrl}/automation/settings`, { method: 'PUT', headers, body: JSON.stringify({ confidenceThreshold: 85, autoLike: true }) });
    console.log(`4b. PUT /api/automation/settings -> ${r4b.status}:`, await r4b.json());

    const r4c = await fetch(`${baseUrl}/automation/settings`, { method: 'POST', headers, body: JSON.stringify({ confidenceThreshold: 85, autoLike: true }) });
    console.log(`4c. POST /api/automation/settings -> ${r4c.status}:`, await r4c.json());

    // Test 5: GET /api/moderation/logs
    const r5 = await fetch(`${baseUrl}/moderation/logs`, { headers });
    console.log(`5. GET /api/moderation/logs -> ${r5.status}:`, await r5.json());

    // Test 6: GET /api/moderation/rules
    const r6 = await fetch(`${baseUrl}/moderation/rules`, { headers });
    console.log(`6. GET /api/moderation/rules -> ${r6.status}:`, await r6.json());

    // Test 7: POST /api/comments/sample_comment_id/like
    const r7 = await fetch(`${baseUrl}/comments/sample_comment_id/like`, { method: 'POST', headers });
    console.log(`7. POST /api/comments/sample_comment_id/like -> ${r7.status}:`, await r7.json());

    // Test 8: POST /api/comments/sample_comment_id/reply
    const r8 = await fetch(`${baseUrl}/comments/sample_comment_id/reply`, { method: 'POST', headers, body: JSON.stringify({ text: 'Great comment!' }) });
    console.log(`8. POST /api/comments/sample_comment_id/reply -> ${r8.status}:`, await r8.json());

    // Test 9: GET /api/comments
    const r9 = await fetch(`${baseUrl}/comments`, { headers });
    console.log(`9. GET /api/comments -> ${r9.status}:`, await r9.json());

    // Test 10: GET /api/analytics/top-videos
    const r10 = await fetch(`${baseUrl}/analytics/top-videos`, { headers });
    console.log(`10. GET /api/analytics/top-videos -> ${r10.status}:`, await r10.json());

    // Test Unknown Route JSON 404
    const rUnknown = await fetch(`${baseUrl}/unknown-path`);
    console.log(`11. GET /api/unknown-path (Global 404 JSON) -> ${rUnknown.status}:`, await rUnknown.json());

    server.close();
    await mongoose.disconnect();
    process.exit(0);
  });
}

runLocalAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
