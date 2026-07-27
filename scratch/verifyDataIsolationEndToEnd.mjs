import '../config/env.mjs';
import mongoose from 'mongoose';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import jwt from 'jsonwebtoken';
import https from 'https';

const PROD_HOST = 'server-youtube-auto.onrender.com';

function makeProdReq(pathStr, method = 'GET', headers = {}, bodyObj = null) {
  return new Promise((resolve) => {
    const payload = bodyObj ? JSON.stringify(bodyObj) : null;
    const reqHeaders = { ...headers };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(
      {
        hostname: PROD_HOST,
        port: 443,
        path: pathStr,
        method,
        headers: reqHeaders
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', err => resolve({ status: 500, error: err.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runEndToEndVerification() {
  console.log('--- 🧪 STARTING END-TO-END DATA ISOLATION VERIFICATION ON LIVE RENDER ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Database connected');

  // Fetch Users
  const techUser = await User.findOne({ email: 'tech@gmail.com' }).lean();
  const velUser = await User.findOne({ email: 'velmurugan61682@gmail.com' }).lean();

  const techToken = jwt.sign(
    { id: techUser._id.toString(), email: techUser.email, role: 'client' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const velToken = jwt.sign(
    { id: velUser._id.toString(), email: velUser.email, role: 'client' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log('\n--- 1. Checking tech@gmail.com on LIVE Render ---');
  const techAnalytics = await makeProdReq('/api/analytics', 'GET', { Authorization: `Bearer ${techToken}` });
  const techDashboard = await makeProdReq('/api/analytics/dashboard', 'GET', { Authorization: `Bearer ${techToken}` });

  console.log('tech@gmail.com Channel Summary:', techAnalytics.data?.channelSummary);
  console.log('tech@gmail.com Dashboard Stats:', techDashboard.data?.data);

  console.log('\n--- 2. Checking velmurugan61682@gmail.com on LIVE Render (Before connecting new channel) ---');
  const velAnalyticsBefore = await makeProdReq('/api/analytics', 'GET', { Authorization: `Bearer ${velToken}` });
  const velDashboardBefore = await makeProdReq('/api/analytics/dashboard', 'GET', { Authorization: `Bearer ${velToken}` });

  console.log('velmurugan61682@gmail.com Channel Summary:', velAnalyticsBefore.data?.channelSummary);
  console.log('velmurugan61682@gmail.com Dashboard Stats:', velDashboardBefore.data?.data);

  console.log('\n--- 3. Connecting a NEW test channel specifically to velmurugan61682@gmail.com ---');
  const newChannelId = `UC_velmurugan_${Date.now()}`;
  await Channel.findOneAndUpdate(
    { userId: velUser._id },
    {
      userId: velUser._id,
      channelId: newChannelId,
      title: "Velmurugan's Tech Channel",
      description: "Official channel of Velmurugan",
      thumbnailUrl: "https://yt3.ggpht.com/a/default_user=s88-c-k-c0x00ffffff-no-rj",
      statistics: {
        subscriberCount: "500",
        videoCount: "15",
        viewCount: "25000",
        commentCount: "10"
      },
      tokens: { accessToken: "mock_token", refreshToken: "mock_refresh" }
    },
    { upsert: true, returnDocument: 'after' }
  );
  console.log(`✓ Linked new channel "${newChannelId}" ("Velmurugan's Tech Channel") to user velmurugan61682@gmail.com`);

  console.log('\n--- 4. Checking velmurugan61682@gmail.com on LIVE Render (After connecting new channel) ---');
  const velAnalyticsAfter = await makeProdReq('/api/analytics', 'GET', { Authorization: `Bearer ${velToken}` });
  const velDashboardAfter = await makeProdReq('/api/analytics/dashboard', 'GET', { Authorization: `Bearer ${velToken}` });

  console.log('velmurugan61682@gmail.com Channel Summary:', velAnalyticsAfter.data?.channelSummary);
  console.log('velmurugan61682@gmail.com Dashboard Stats:', velDashboardAfter.data?.data);

  console.log('\n--- 5. Re-checking tech@gmail.com on LIVE Render to confirm NO CROSS-CONTAMINATION ---');
  const techAnalyticsFinal = await makeProdReq('/api/analytics', 'GET', { Authorization: `Bearer ${techToken}` });
  const techDashboardFinal = await makeProdReq('/api/analytics/dashboard', 'GET', { Authorization: `Bearer ${techToken}` });

  console.log('tech@gmail.com Final Channel Summary:', techAnalyticsFinal.data?.channelSummary);
  console.log('tech@gmail.com Final Dashboard Stats:', techDashboardFinal.data?.data);

  await mongoose.disconnect();
  console.log('\n--- VERIFICATION FINISHED ---');
}

runEndToEndVerification().catch(console.error);
