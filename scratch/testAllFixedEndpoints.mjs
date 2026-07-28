import fetch from 'node-fetch';

const baseUrl = 'https://server-youtube-auto.onrender.com/api';

async function runTests() {
  console.log('=== STARTING ALL 10 ENDPOINTS INTEGRATION TEST ===\n');

  // 1. Authenticate to get JWT token
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.com', password: 'Password@123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log(`🔑 Login Status: ${loginRes.status} | Token Received: ${!!token}`);

  const authHeader = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 1. GET /api/analytics/sentiment-breakdown
  const r1 = await fetch(`${baseUrl}/analytics/sentiment-breakdown`, { headers: authHeader });
  console.log(`1. GET /api/analytics/sentiment-breakdown -> ${r1.status}:`, await r1.json());

  // 2. GET /api/analytics/overview
  const r2 = await fetch(`${baseUrl}/analytics/overview`, { headers: authHeader });
  console.log(`2. GET /api/analytics/overview -> ${r2.status}:`, await r2.json());

  // 3. POST /api/automation/trigger-sync
  const r3 = await fetch(`${baseUrl}/automation/trigger-sync`, { method: 'POST', headers: authHeader });
  console.log(`3. POST /api/automation/trigger-sync -> ${r3.status}:`, await r3.json());

  // 4. GET & PUT /api/automation/settings
  const r4a = await fetch(`${baseUrl}/automation/settings`, { headers: authHeader });
  console.log(`4a. GET /api/automation/settings -> ${r4a.status}:`, await r4a.json());

  const r4b = await fetch(`${baseUrl}/automation/settings`, { 
    method: 'PUT', 
    headers: authHeader,
    body: JSON.stringify({ confidenceThreshold: 85, autoLike: true })
  });
  console.log(`4b. PUT /api/automation/settings -> ${r4b.status}:`, await r4b.json());

  // 5. GET /api/moderation/logs
  const r5 = await fetch(`${baseUrl}/moderation/logs`, { headers: authHeader });
  console.log(`5. GET /api/moderation/logs -> ${r5.status}:`, await r5.json());

  // 6. GET /api/moderation/rules
  const r6 = await fetch(`${baseUrl}/moderation/rules`, { headers: authHeader });
  console.log(`6. GET /api/moderation/rules -> ${r6.status}:`, await r6.json());

  // 7. POST /api/comments/:commentId/like
  const r7 = await fetch(`${baseUrl}/comments/sample_comment_123/like`, { method: 'POST', headers: authHeader });
  console.log(`7. POST /api/comments/sample_comment_123/like -> ${r7.status}:`, await r7.json());

  // 8. POST /api/comments/:commentId/reply
  const r8 = await fetch(`${baseUrl}/comments/sample_comment_123/reply`, { 
    method: 'POST', 
    headers: authHeader,
    body: JSON.stringify({ text: 'Thank you for your feedback!' })
  });
  console.log(`8. POST /api/comments/sample_comment_123/reply -> ${r8.status}:`, await r8.json());

  // 9. GET /api/comments
  const r9 = await fetch(`${baseUrl}/comments`, { headers: authHeader });
  console.log(`9. GET /api/comments -> ${r9.status}:`, await r9.json());

  // 10. GET /api/analytics/top-videos
  const r10 = await fetch(`${baseUrl}/analytics/top-videos`, { headers: authHeader });
  console.log(`10. GET /api/analytics/top-videos -> ${r10.status}:`, await r10.json());

  console.log('\n=== ALL 10 ENDPOINTS TEST COMPLETED ===');
}

runTests().catch(console.error);
