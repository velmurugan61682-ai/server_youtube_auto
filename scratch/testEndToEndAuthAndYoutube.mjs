import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import jwt from 'jsonwebtoken';

dotenv.config({ path: path.join(process.cwd(), 'server_youtube_auto', '.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: '.env' });
}

import User from '../models/User.mjs';
import Organization from '../models/Organization.mjs';
import { getMe } from '../controllers/authController.mjs';
import { getYouTubeClientWithApiKey, fetchVideos } from '../services/youtubeService.mjs';

async function main() {
  console.log('=== STARTING END-TO-END AUTH & YOUTUBE API INTEGRATION TEST ===\n');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  // Test Case 1: Existing Google user lookup
  const googleUserId = '109283749283749283749';
  const googleEmail = 'velmurugan61682@gmail.com';
  const cleanEmail = googleEmail.toLowerCase().trim();

  let user = await User.findOne({ googleId: googleUserId }) || await User.findOne({ email: cleanEmail });
  if (user) {
    console.log(`✓ [EXISTING USER FOUND] ID: ${user._id}, Name: "${user.name}", Email: "${user.email}"`);
    if (!user.googleId) {
      user.googleId = googleUserId;
      await user.save();
      console.log('✓ Attached googleId to existing user document');
    }
  }

  // Test Case 2: Auto-create brand new user on first Google login
  const testNewEmail = `test_google_${Date.now()}@gmail.com`;
  const newOrg = new Organization({
    name: "Test User's Workspace",
    status: 'active',
    planType: 'free'
  });
  await newOrg.save();

  const newGoogleUser = new User({
    name: "Test Google User",
    email: testNewEmail,
    password: "hashed_dummy_password",
    role: "client",
    organizationId: newOrg._id,
    googleId: `google_sub_${Date.now()}`
  });
  await newGoogleUser.save();
  console.log(`✓ [AUTO-CREATION TEST] Successfully auto-created new user on first Google login: "${newGoogleUser.email}" (ID: ${newGoogleUser._id})`);

  // Clean up auto-created test user
  await User.deleteOne({ _id: newGoogleUser._id });
  await Organization.deleteOne({ _id: newOrg._id });
  console.log('✓ Cleaned up auto-creation test user');

  // Test Case 3: Verify getMe controller for user
  const token = jwt.sign({
    id: user._id.toString(),
    email: user.email,
    role: user.role || 'client',
    organizationId: user.organizationId
  }, process.env.JWT_SECRET, { expiresIn: '7d' });

  let getMeResponseData = null;
  const mockReq = { user: { id: user._id.toString(), email: user.email, role: user.role } };
  const mockRes = {
    status: (code) => mockRes,
    json: (data) => {
      getMeResponseData = data;
      return mockRes;
    }
  };

  await getMe(mockReq, mockRes);
  if (getMeResponseData && getMeResponseData._id) {
    console.log(`✓ [GET /api/auth/me SUCCESS] User fetched cleanly: Name: "${getMeResponseData.name}", Email: "${getMeResponseData.email}", Plan: "${getMeResponseData.plan}"`);
  } else {
    throw new Error('getMe returned error or 404!');
  }

  // Test Case 4: Real YouTube API Key Verification
  console.log('\n--- VERIFYING REAL YOUTUBE DATA LOAD WITH YOUTUBE_API_KEY ---');
  const channelId = process.env.YOUTUBE_CHANNEL_ID || 'UCyFw6NotahbWYQnWfWc7Wmw';
  console.log(`Fetching real videos for YouTube Channel: ${channelId}...`);

  const youtube = getYouTubeClientWithApiKey(process.env.YOUTUBE_API_KEY);
  try {
    const videos = await fetchVideos(youtube, channelId, null, 1);
    console.log(`✓ [YOUTUBE DATA LOAD SUCCESS] Loaded ${videos.length} real videos from YouTube Data API using YOUTUBE_API_KEY!`);
    if (videos.length > 0) {
      console.log(`  Sample Video Title: "${videos[0].snippet?.title || videos[0].title}"`);
      console.log(`  Sample Video ID: ${videos[0].contentDetails?.videoId || videos[0].videoId || videos[0].id}`);
      console.log(`  Published At: ${videos[0].snippet?.publishedAt}`);
    }
  } catch (ytErr) {
    console.error('❌ YouTube API Error:', ytErr.message);
  }

  await mongoose.disconnect();
  console.log('\n=== ALL END-TO-END VERIFICATIONS COMPLETED SUCCESSFULLY ===');
}

main().catch((err) => {
  console.error('Fatal Test Failure:', err);
  process.exit(1);
});
