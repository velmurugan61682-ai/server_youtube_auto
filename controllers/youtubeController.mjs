import bcrypt from 'bcryptjs';
import axios from 'axios';
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import Video from '../models/Video.mjs';
import User from '../models/User.mjs';
import Organization from '../models/Organization.mjs';
import logger from '../utils/logger.mjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import OAuthState from '../models/OAuthState.mjs';
import {
  getYouTubeAuth,
  getYouTubeClient,
  getYouTubeClientWithApiKey,
  fetchVideos,
  fetchAllVideos,
  fetchPlaylists,
  getAuthFromClient,
  fetchVideoStatisticsBatch,
  scrapeCommunityPosts
} from '../services/youtubeService.mjs';
import { processComments } from '../services/commentProcessingService.mjs';
import { encrypt, decrypt } from '../utils/cryptoHelper.mjs';

const JWT_SECRET = process.env.JWT_SECRET;

const activeRefreshes = new Set();

// Select FRONTEND_URL dynamically based on request origin/referer or process.env
const getFrontendUrl = (req) => {
  if (req) {
    const ref = req.get('referer') || req.get('origin');
    if (ref) {
      try {
        const u = new URL(ref);
        if (u.hostname === 'channelbot.in' || u.hostname === 'www.channelbot.in') {
          return `${u.protocol}//${u.host}`;
        }
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
          return `${u.protocol}//${u.host}`;
        }
      } catch (_) {}
    }
  }
  const isProduction = process.env.NODE_ENV === 'production';
  const base = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || (isProduction ? 'https://channelbot.in' : 'http://localhost:5173');
  return base.replace(/\/dashboard\/?$/, '').replace(/\/+$/, '');
};


export const initiateAuth = async (req, res) => {
  try {
    // Explicitly check if this is a login flow (from /auth/google or query param flow=login)
    const isExplicitLoginFlow = req.originalUrl?.includes('/auth/google') || req.path?.includes('/auth/google') || req.query.flow === 'login';
    const userId = isExplicitLoginFlow ? null : (req.user ? req.user.id : null);
    const isLoginFlow = isExplicitLoginFlow || !userId;

    if (userId) {
      const user = await User.findById(userId).lean();
      if (!user) return res.status(404).json({ error: 'User not found' });

      let org = null;
      if (user.organizationId) {
        org = await Organization.findById(user.organizationId).lean();
      }

      const isAdmin = user.role === 'admin';
      const subStatus = org?.subscription?.status || user?.subscription?.status || 'active';
      const planType = org?.subscription?.planType || user?.subscription?.planId || 'free';
      const isSubActive = subStatus === 'active' || subStatus === 'completed';

      const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
      const isTrialExpired = new Date() > new Date((user.createdAt || new Date()).getTime() + oneMonthMs);

      let channelLimit = 1;
      let planName = 'Free Plan';

      if (isAdmin) {
        channelLimit = 1000;
        planName = 'Admin';
      } else if (isSubActive) {
        if (planType === 'free') {
          channelLimit = 1;
          planName = 'Free Plan';
        } else if (planType === 'one_rupee') {
          channelLimit = 1;
          planName = 'INR 1 Plan';
        } else if (planType === 'monthly_345') {
          channelLimit = 5;
          planName = 'INR 345 Plan';
        } else if (planType === 'two_months_600') {
          channelLimit = 10;
          planName = 'INR 600 Plan';
        } else if (planType === 'three_months_999' || planType === 'quarterly_pro' || planType === 'annual_pro') {
          channelLimit = 1000;
          planName = 'Premium Pro';
        } else {
          channelLimit = 1;
          planName = 'Free Plan';
        }
      } else {
        if (isTrialExpired) {
          channelLimit = 0;
          planName = 'Expired Free Trial';
        } else {
          channelLimit = 1;
          planName = 'Free Plan';
        }
      }

      const connectedChannelsCount = await Channel.countDocuments({ userId });
      if (connectedChannelsCount >= channelLimit) {
        logger.warn(`Billing: User ${user.email} blocked from initiating channel link. Count: ${connectedChannelsCount}, Limit for ${planName}: ${channelLimit}`);
        let errorMsg = `Your ${planName} is limited to ${channelLimit} YouTube channel(s). Please upgrade your plan to connect more accounts.`;
        return res.status(403).json({ error: errorMsg });
      }
    }

    const state = crypto.randomUUID();

    console.log(`[OAuth State Gen] ✅ Generated OAuth state for user ${userId || 'guest'} (isLoginFlow: ${isLoginFlow})`);
    console.log(`[OAuth State Gen] TTL: 5 minutes`);

    // Store state mapping in MongoDB (TTL is 5 minutes as per schema)
    const stateDoc = await OAuthState.findOneAndUpdate(
      { state },
      { state, userId: userId || null, isLoginFlow },
      { upsert: true, returnDocument: 'after' }
    );

    console.log(`[OAuth State Gen] ✅ State stored in MongoDB`);
    console.log(`[OAuth State Gen] Document ID: ${stateDoc._id}`);
    console.log(`[OAuth State Gen] Will expire at: ${new Date(stateDoc.createdAt.getTime() + 5 * 60 * 1000).toISOString()}`);

    const client = getYouTubeAuth();
    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      state: state, // Secure random UUID state
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.force-ssl'
      ],
    });

    console.log(`[OAuth State Gen] ✅ Auth URL generated`);
    console.log(`[OAuth State Gen] Redirect will happen to Google OAuth`);

    res.json({ redirectUrl: authUrl });
  } catch (err) {
    logger.error(`[OAuth State Gen] ❌ Failed to generate OAuth URL: ${err.message}`);
    console.error(`[OAuth State Gen] Error Stack:`, err.stack);
    res.status(500).json({ error: 'OAuth Configuration Error', details: err.message });
  }
};

export const handleCallback = async (req, res) => {
  const frontendUrl = getFrontendUrl(req);
  const { code, state, error: oauthError } = req.query;

  // ── DIAGNOSTIC: always log resolved frontendUrl so it appears in Render logs ──
  console.log(`[OAuth Callback] Resolved frontendUrl: "${frontendUrl}"`);
  console.log(`[OAuth Callback] Referer header: "${req.get('referer') || 'none'}", Origin: "${req.get('origin') || 'none'}"`);

  // OAuth callback logging without credentials
  console.log(`[OAuth State Ver] Callback received:`);
  console.log(`  - State: ${state}`);
  console.log(`  - OAuth Error: ${oauthError || 'none'}`);

  if (oauthError) {
    logger.error(`[OAuth Error] Google OAuth error received: ${oauthError}`);
    return res.redirect(`${frontendUrl}/oauth/callback?status=error&error=${encodeURIComponent(oauthError)}`);
  }

  if (!state) {
    logger.error('[OAuth Error] Missing state parameter from Google redirect');
    console.error('[OAuth Error] Missing state parameter - this is a critical OAuth security violation');
    return res.redirect(`${frontendUrl}/oauth/callback?status=error&error=${encodeURIComponent('Missing state parameter')}`);
  }

  if (!code) {
    logger.error('[OAuth Error] Missing authorization code from Google');
    return res.redirect(`${frontendUrl}/oauth/callback?status=error&error=${encodeURIComponent('Missing authorization code')}`);
  }

  // Look up state mapping (with duplicate request protection)
  let stateRecord = null;
  try {
    stateRecord = await OAuthState.findOne({ state });
    if (!stateRecord) {
      console.log(`[OAuth State Ver] State record NOT found for state: ${state}`);
      logger.error(`[OAuth Error] Invalid or expired OAuth state: ${state}`);
      return res.redirect(`${frontendUrl}/oauth/callback?status=error&error=${encodeURIComponent('Invalid or expired state parameter')}`);
    }

    // Handle duplicate callback requests gracefully (e.g. Chrome pre-fetch or double redirects)
    if (stateRecord.redirectUrl) {
      console.log(`[OAuth State Ver] Reusing cached redirect URL for duplicate state request: ${state}`);
      return res.redirect(stateRecord.redirectUrl);
    }

    console.log(`[OAuth State Ver] ✅ State verified successfully for user: ${stateRecord.userId || 'guest'}`);
  } catch (dbErr) {
    logger.error(`[OAuth Error] Database error during state verification: ${dbErr.message}`);
    return res.redirect(`${frontendUrl}/oauth/callback?status=error&error=${encodeURIComponent('Database error during verification')}`);
  }

  const userId = stateRecord.userId;
  const isLoginFlow = stateRecord.isLoginFlow || !userId;

  let tokens = null;
  let channelRes = null;
  let channel = null;

  try {
    const client = getYouTubeAuth();

    // ── DEBUG: Before token exchange ──
    console.log(`[OAuth Debug] ── Token Exchange START ──`);
    console.log(`[OAuth Debug] Authorization code (first 20 chars): ${code ? code.substring(0, 20) + '...' : 'MISSING'}`);
    console.log(`[OAuth Debug] Redirect URI used by OAuth2 client: ${client.redirectUri || client._redirectUri || 'UNKNOWN'}`);
    console.log(`[OAuth Debug] Client ID (last 10 chars): ...${(client._clientId || '').slice(-10)}`);

    let tokenResponse;
    try {
      tokenResponse = await client.getToken(code);
    } catch (tokenExchangeErr) {
      console.error(`[OAuth Debug] ❌ Token exchange THREW an error:`);
      console.error(`[OAuth Debug]   Error message: ${tokenExchangeErr.message}`);
      console.error(`[OAuth Debug]   Error response data:`, tokenExchangeErr.response?.data || 'N/A');
      console.error(`[OAuth Debug]   Error status:`, tokenExchangeErr.response?.status || 'N/A');
      throw tokenExchangeErr; // re-throw so existing catch block handles it
    }

    // ── DEBUG: After token exchange ──
    console.log(`[OAuth Debug] ── Token Exchange SUCCESS ──`);
    console.log(`[OAuth Debug] tokenResponse keys: ${Object.keys(tokenResponse || {})}`);
    console.log(`[OAuth Debug] tokenResponse.tokens keys: ${Object.keys(tokenResponse?.tokens || {})}`);
    console.log(`[OAuth Debug] Has access_token: ${!!tokenResponse?.tokens?.access_token}`);
    console.log(`[OAuth Debug] Has refresh_token: ${!!tokenResponse?.tokens?.refresh_token}`);
    console.log(`[OAuth Debug] Has id_token: ${!!tokenResponse?.tokens?.id_token}`);
    console.log(`[OAuth Debug] Token type: ${tokenResponse?.tokens?.token_type || 'MISSING'}`);
    console.log(`[OAuth Debug] Expiry date: ${tokenResponse?.tokens?.expiry_date || 'MISSING'}`);
    console.log(`[OAuth Debug] Scope: ${tokenResponse?.tokens?.scope || 'MISSING'}`);

    tokens = tokenResponse.tokens;
    client.setCredentials(tokens);
    logger.info('OAuth Token exchange successful');

    // Handle guest Google OAuth login/signup
    if (isLoginFlow || !userId) {
      let googleUserId = null;
      let googleEmail = null;
      let googleName = null;
      let picture = '';

      if (tokens.id_token) {
        try {
          const decoded = jwt.decode(tokens.id_token);
          if (decoded) {
            googleUserId = decoded.sub;
            googleEmail = decoded.email;
            googleName = decoded.name || decoded.email?.split('@')[0];
            picture = decoded.picture || '';
          }
        } catch (e) {
          logger.error('Failed to decode id_token:', e);
        }
      }

      if (!googleEmail && tokens.access_token) {
        try {
          const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
          });
          googleEmail = userInfoRes.data.email;
          googleName = userInfoRes.data.name || googleEmail.split('@')[0];
          picture = userInfoRes.data.picture || '';
          googleUserId = userInfoRes.data.sub;
        } catch (e) {
          logger.error('Failed to fetch userinfo from Google:', e.message);
        }
      }

      if (!googleEmail) {
        return res.redirect(`${getFrontendUrl(req)}/oauth/callback?status=error&error=${encodeURIComponent('Unable to connect to Google. Please try again.')}`);
      }

      let guestUser = await User.findOne({ email: new RegExp(`^${googleEmail.trim()}$`, 'i') });
      if (!guestUser) {
        const hashedPassword = await bcrypt.hash(`google_oauth_${Date.now()}_${Math.random()}`, 12);
        const newOrg = new Organization({
          name: `${googleName}'s Workspace`,
          status: 'active',
          planType: 'free'
        });
        await newOrg.save();

        guestUser = new User({
          name: googleName,
          email: googleEmail.toLowerCase().trim(),
          password: hashedPassword,
          role: 'client',
          organizationId: newOrg._id,
          profilePicture: picture
        });
        await guestUser.save();
        logger.info(`[Google OAuth] Auto-created user: ${guestUser.email}`);
      }

      const jwtSecret = process.env.JWT_SECRET;

      // ── GUARD: explicit JWT_SECRET validation before signing ──
      if (!jwtSecret || jwtSecret.trim() === '') {
        console.error('[OAuth Login] CRITICAL: JWT_SECRET is missing or empty. Cannot sign token.');
        return res.redirect(`${frontendUrl}/oauth/callback?status=error&error=${encodeURIComponent('Server configuration error: authentication signing key is not set. Please contact support.')}`);
      }

      const token = jwt.sign({
        id: guestUser._id,
        email: guestUser.email,
        role: guestUser.role || 'client',
        organizationId: guestUser.organizationId
      }, jwtSecret, { expiresIn: '7d' });

      // ── GUARD: ensure token was actually produced ──
      if (!token) {
        console.error('[OAuth Login] CRITICAL: jwt.sign() returned a falsy value. JWT_SECRET may be invalid.');
        return res.redirect(`${frontendUrl}/oauth/callback?status=error&error=${encodeURIComponent('Server error: failed to generate authentication token. Please try again.')}`);
      }

      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      const targetRedirect = `${frontendUrl}/oauth/callback?token=${token}&status=success`;

      // ── DIAGNOSTIC: log the exact final redirect URL so it appears in Render logs ──
      console.log(`[OAuth Login] ✅ Redirecting to: ${frontendUrl}/oauth/callback?token=<jwt_redacted>&status=success`);

      await OAuthState.updateOne({ state }, { $set: { redirectUrl: targetRedirect } });
      return res.redirect(targetRedirect);
    }

    const user = await User.findById(userId).lean();
    logger.info('Google token received');

    const youtube = getYouTubeClient(tokens, null, null);
    channelRes = await youtube.channels.list({ part: 'snippet,contentDetails,statistics', mine: true });
    const items = channelRes.data.items;

    if (!items || items.length === 0) {
      logger.error('YouTube Channel Response empty items');
      return res.redirect(`${frontendUrl}/oauth/callback?status=error&error=${encodeURIComponent('No YouTube channel found on this Google Account. Please create a channel on YouTube and try again.')}`);
    }

    const channelData = items[0];
    let existingChannel = await Channel.findOne({ channelId: channelData.id }).lean();

    if (existingChannel && existingChannel.userId.toString() !== userId.toString()) {
      logger.info(`Reassigning YouTube channel ${channelData.id} to newly authenticated user ${userId}`);
      const collections = [
        { model: Comment, name: 'Comment' },
        { model: Video, name: 'Video' },
        { model: ModerationLog, name: 'ModerationLog' },
        { model: AutoReplyLog, name: 'AutoReplyLog' },
        { model: Lead, name: 'Lead' }
      ];

      for (const { model, name } of collections) {
        try {
          await model.updateMany({ channelId: channelData.id }, { $set: { userId } });
        } catch (err) {
          if (err.code === 11000) {
            logger.warn(`Duplicate key error transferring ${name} for channel ${channelData.id}. Cleaning up remaining legacy records.`);
            await model.deleteMany({ channelId: channelData.id, userId: existingChannel.userId });
          } else {
            logger.error(`Error transferring ${name}: ${err.message}`);
          }
        }
      }
    }

    // Post-flight check: prevent exceeding channel limits based on subscription plan
    const isReconnectingOwnChannel = !!existingChannel;
    if (!isReconnectingOwnChannel) {
      let org = null;
      if (user && user.organizationId) {
        org = await Organization.findById(user.organizationId).lean();
      }

      const isAdmin = user && user.role === 'admin';
      const subStatus = org?.subscription?.status || user?.subscription?.status || 'active';
      const planType = org?.subscription?.planType || user?.subscription?.planId || 'free';
      const isSubActive = subStatus === 'active' || subStatus === 'completed';

      const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
      const isTrialExpired = new Date() > new Date(((user && user.createdAt) || new Date()).getTime() + oneMonthMs);

      let channelLimit = 1;
      let planName = 'Free Plan';

      if (isAdmin) {
        channelLimit = 1000;
        planName = 'Admin';
      } else if (isSubActive) {
        if (planType === 'free') {
          channelLimit = 1;
          planName = 'Free Plan';
        } else if (planType === 'one_rupee') {
          channelLimit = 1;
          planName = 'INR 1 Plan';
        } else if (planType === 'monthly_345') {
          channelLimit = 5;
          planName = 'INR 345 Plan';
        } else if (planType === 'two_months_600') {
          channelLimit = 10;
          planName = 'INR 600 Plan';
        } else if (planType === 'three_months_999' || planType === 'quarterly_pro' || planType === 'annual_pro') {
          channelLimit = 1000;
          planName = 'Premium Pro';
        } else {
          channelLimit = 1;
          planName = 'Free Plan';
        }
      } else {
        if (isTrialExpired) {
          channelLimit = 0;
          planName = 'Expired Free Trial';
        } else {
          channelLimit = 1;
          planName = 'Free Plan';
        }
      }

      const connectedChannelsCount = await Channel.countDocuments({ userId });
      if (connectedChannelsCount >= channelLimit) {
        logger.warn(`Billing: User ${user?.email} blocked from connecting channel. Count: ${connectedChannelsCount}, Limit for ${planName}: ${channelLimit}`);
        let errorMsg = `Your ${planName} plan is limited to ${channelLimit} YouTube channel(s). Please upgrade your plan to connect more accounts.`;
        if (channelLimit === 0) {
          errorMsg = 'Your 30-day Free Trial has expired. Please subscribe to a plan to connect channels.';
        }
        return res.redirect(`${frontendUrl}/dashboard?status=error&error=${encodeURIComponent(errorMsg)}`);
      }
    }

    const auth = getAuthFromClient(youtube);
    if (existingChannel && auth) {
      auth.channelDbId = existingChannel._id;
    }
    const uploadsPlaylistId = channelData.contentDetails?.relatedPlaylists?.uploads || '';

    // Fetch all playlists for the channel
    const playlists = await fetchPlaylists(youtube, channelData.id);

    let googleUserId = null;
    if (tokens.id_token) {
      try {
        const decoded = jwt.decode(tokens.id_token);
        if (decoded && decoded.sub) {
          googleUserId = decoded.sub;
        }
      } catch (e) {
        logger.error('Failed to decode id_token:', e);
      }
    }

    const updateData = {
      userId,
      organizationId: user?.organizationId || null,
      googleUserId,
      channelId: channelData.id,
      title: channelData.snippet.title,
      customUrl: channelData.snippet.customUrl || '',
      description: channelData.snippet.description || '',
      thumbnailUrl: channelData.snippet.thumbnails?.default?.url || '',
      accessToken: encrypt(tokens.access_token),
      uploadsPlaylistId,
      playlists,
      reconnectRequired: false,
      reconnectReason: '',
      status: 'connected',
      statistics: {
        subscriberCount: channelData.statistics?.subscriberCount || '0',
        videoCount: channelData.statistics?.videoCount || '0',
        viewCount: channelData.statistics?.viewCount || '0',
      }
    };

    if (tokens.refresh_token) {
      updateData.refreshToken = encrypt(tokens.refresh_token);
    } else if (existingChannel && existingChannel.refreshToken) {
      updateData.refreshToken = existingChannel.refreshToken;
    }

    if (tokens.expiry_date) updateData.expiryDate = tokens.expiry_date;

    channel = await Channel.findOneAndUpdate(
      { channelId: channelData.id },
      { $set: updateData },
      { upsert: true, returnDocument: 'after' }
    );
    logger.info(`Channel saved to MongoDB: ${channel.title} (ID: ${channel.channelId}, Google User ID: ${channel.googleUserId})`);
    logger.info('Channel connected');

    // Sync organizationId and userId on existing Videos and Comments for this channel
    try {
      await Video.updateMany(
        { channelId: channelData.id },
        { $set: { userId: channel.userId, organizationId: channel.organizationId } }
      );
      await Comment.updateMany(
        { channelId: channelData.id },
        { $set: { userId: channel.userId, organizationId: channel.organizationId } }
      );
    } catch (syncErr) {
      logger.error(`Failed to sync videos/comments organizationId for channel ${channelData.id}: ${syncErr.message}`);
    }

    // Trigger initial background process (processComments expects raw/decrypted tokens)
    const io = req.app.get('io');
    processComments(channel, tokens, null, io).catch(err =>
      logger.error('Initial processComments error:', err)
    );

    const targetRedirect = `${frontendUrl}/oauth/callback?status=success&channelId=${channel.channelId}`;
    await OAuthState.updateOne({ state }, { $set: { redirectUrl: targetRedirect } });
    return res.redirect(targetRedirect);
  } catch (error) {
    if (error.code === 11000) {
      logger.error('COMPLETE_MONGODB_DUPLICATE_KEY_ERROR:', {
        code: error.code,
        keyPattern: error.keyPattern,
        keyValue: error.keyValue,
        message: error.message,
        stack: error.stack
      });
      console.error('COMPLETE MongoDB Duplicate Key Error:', {
        code: error.code,
        keyPattern: error.keyPattern,
        keyValue: error.keyValue
      });
    }

    logger.error('Authentication/Callback Failure:', {
      message: error.message,
      stack: error.stack,
      oauthCode: code ? `${code.substring(0, 10)}...` : null,
      tokenExchange: tokens ? {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date
      } : null,
      youtubeResponse: channelRes ? {
        hasData: !!channelRes.data,
        itemsCount: channelRes.data?.items?.length
      } : null,
      mongoDbSave: channel ? {
        id: channel._id,
        channelId: channel.channelId
      } : null,
      googleResponseError: error.response?.data || null
    });

    // Explicit production-grade error logging as requested
    console.error(error);
    if (error.stack) console.error(error.stack);
    try {
      console.error(JSON.stringify(error, null, 2));
    } catch (jsonErr) {
      console.error('Failed to stringify error object:', error);
    }

    return res.redirect(`${frontendUrl}/oauth/callback?status=error&error=${encodeURIComponent(error.message || 'OAuth Authentication failed')}`);
  }
};

export const getChannels = async (req, res) => {
  try {
    const filter = req.user.organizationId
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }] }
      : { userId: req.user.id };
    const channels = await Channel.find(filter)
      .select('title channelId thumbnailUrl apiKey reconnectRequired reconnectReason statistics')
      .lean();
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const deleteChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const filter = req.user.organizationId
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }], channelId }
      : { userId: req.user.id, channelId };
    const deletedChannel = await Channel.findOneAndDelete(filter);
    if (!deletedChannel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    await Comment.deleteMany({ channelId });
    res.json({ success: true, message: 'Channel disconnected' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect channel' });
  }
};

export const getVideos = async (req, res) => {
  try {
    const { channelId } = req.query;
    if (!channelId) return res.status(400).json({ error: 'channelId is required' });

    const isAdmin = req.user.role === 'admin' || req.user.isAdmin;
    const filterChannel = isAdmin
      ? { channelId }
      : (req.user.organizationId
          ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }], channelId }
          : { userId: req.user.id, channelId });

    const channel = await Channel.findOne(filterChannel).lean();
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    let videos = await Video.find({ channelId }).sort({ publishedAt: -1 }).lean();

    // Async non-blocking background sync function
    const triggerBackgroundVideoSync = async () => {
      try {
        await syncCommunityPostsForChannel(channel, req.user.id);
      } catch (postSyncErr) {
        logger.error(`Failed to sync community posts: ${postSyncErr.message}`);
      }

      const staleTime = Date.now() - 15 * 60000;
      const refreshCandidates = videos.filter(v => (
        !v.isPost &&
        (!v.duration || !v.lastFetchedAt || !v.statistics || typeof v.statistics.viewCount !== 'number' || v.lastFetchedAt.getTime() < staleTime)
      ));
      if (refreshCandidates.length === 0 && videos.length > 0) return;

      if (channel.reconnectRequired || (!channel.accessToken && !channel.apiKey)) return;

      const refreshKey = `${req.user.id}_${channelId}`;
      if (activeRefreshes.has(refreshKey)) return;

      activeRefreshes.add(refreshKey);
      try {
        let youtube;
        if (channel.apiKey) {
          youtube = getYouTubeClientWithApiKey(decrypt(channel.apiKey));
        } else {
          const decryptedTokens = {
            access_token: decrypt(channel.accessToken),
            refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
            expiry_date: channel.expiryDate
          };
          youtube = getYouTubeClient(decryptedTokens, null, channel._id);
        }

        const uploadedVideos = await fetchAllVideos(youtube, channel.channelId);
        if (uploadedVideos.length > 0) {
          const uploadBulkOps = uploadedVideos.map(v => {
            const titleUpper = String(v.title || '').trim().toUpperCase();
            const isLiveTitle = titleUpper.startsWith('LIVE |') ||
              titleUpper.startsWith('LIVE:') ||
              titleUpper.startsWith('[LIVE]') ||
              titleUpper.startsWith('LIVE -') ||
              titleUpper.includes('LIVE STREAM') ||
              titleUpper.includes('STREAMED LIVE') ||
              titleUpper.includes('WAS LIVE');

            const setData = {
              userId: channel.userId || req.user.id,
              organizationId: channel.organizationId || null,
              channelId: channel.channelId,
              videoId: v.videoId,
              title: v.title,
              description: v.description,
              thumbnail: v.thumbnail,
              publishedAt: v.publishedAt
            };

            if (isLiveTitle) {
              setData.isLive = true;
              setData.liveBroadcastContent = 'completed';
            }

            return {
              updateOne: {
                filter: { channelId: channel.channelId, videoId: v.videoId },
                update: { $set: setData },
                upsert: true
              }
            };
          });
          await Video.bulkWrite(uploadBulkOps);
          videos = await Video.find({ channelId }).sort({ publishedAt: -1 }).lean();
        }

        const videosToRefresh = videos.filter(v => (
          !v.isPost &&
          (!v.duration || !v.lastFetchedAt || !v.statistics || typeof v.statistics.viewCount !== 'number' || v.lastFetchedAt.getTime() < staleTime)
        ));

        const videoIds = [...new Set(videosToRefresh.map(v => v.videoId).filter(Boolean))];
        const apiStatsItems = videoIds.length > 0 ? await fetchVideoStatisticsBatch(youtube, videoIds) : [];

        const todayStr = new Date().toISOString().split('T')[0];
        const videosById = new Map();
        for (const v of videos) {
          if (!videosById.has(v.videoId)) {
            videosById.set(v.videoId, []);
          }
          videosById.get(v.videoId).push(v);
        }
        const bulkOps = [];

        for (const item of apiStatsItems) {
          const viewCount = parseInt(item.statistics?.viewCount || 0);
          const likeCount = parseInt(item.statistics?.likeCount || 0);
          const commentCount = parseInt(item.statistics?.commentCount || 0);
          const engagementRate = viewCount > 0 ? parseFloat((((likeCount + commentCount) / viewCount) * 100).toFixed(2)) : 0;

          const matchedVideos = videosById.get(item.id) || [];
          for (const video of matchedVideos) {
            let history = video.likesHistory || [];
            if (history.length > 0) {
              const lastEntry = history[history.length - 1];
              const lastEntryDateStr = new Date(lastEntry.date).toISOString().split('T')[0];
              if (lastEntryDateStr === todayStr) {
                lastEntry.likeCount = likeCount;
              } else {
                history.push({ date: new Date(), likeCount });
              }
            } else {
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              history = [
                { date: yesterday, likeCount: Math.max(0, likeCount - Math.floor(Math.random() * 5)) },
                { date: new Date(), likeCount }
              ];
            }
            if (history.length > 30) history.shift();

            const duration = item.contentDetails?.duration || video.duration || '';
            bulkOps.push({
              updateOne: {
                filter: { _id: video._id },
                update: {
                  $set: {
                    statistics: { viewCount, likeCount, commentCount },
                    duration,
                    engagementRate,
                    likesHistory: history,
                    lastFetchedAt: new Date()
                  }
                }
              }
            });
          }
        }

        if (bulkOps.length > 0) {
          await Video.bulkWrite(bulkOps);
        }
      } catch (syncErr) {
        logger.error(`[SYNC] Background video refresh error: ${syncErr.message}`);
      } finally {
        activeRefreshes.delete(refreshKey);
      }
    };

    if (videos.length > 0) {
      setImmediate(triggerBackgroundVideoSync);
    } else {
      await triggerBackgroundVideoSync();
      videos = await Video.find({ channelId }).sort({ publishedAt: -1 }).lean();
    }

    // Deduplicate videos and posts to guarantee uniqueness
    const uniqueVideos = [];
    const seenVideoKeys = new Set();
    for (const v of videos) {
      const key = (v.isPost || v.videoId?.startsWith('yt_post_'))
        ? `${v.channelId}_post_${(v.title || '').trim().toLowerCase()}`
        : v.videoId;
      if (key && !seenVideoKeys.has(key)) {
        seenVideoKeys.add(key);
        uniqueVideos.push(v);
      }
    }
    return res.json(uniqueVideos);
  } catch (error) {
    logger.error(`Error in getVideos: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const getVideoAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'admin' || req.user.isAdmin;

    let video;
    if (isAdmin) {
      video = await Video.findOne({ videoId: id }).lean();
    } else {
      const filterUser = req.user.organizationId
        ? { $or: [{ organizationId: req.user.organizationId }, { _id: req.user.id }] }
        : { _id: req.user.id };
      const users = await User.find(filterUser).select('_id').lean();
      const userIds = users.map(u => u._id);

      const filterChannel = req.user.organizationId
        ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }] }
        : { userId: req.user.id };
      const channels = await Channel.find(filterChannel).select('channelId').lean();
      const channelIds = channels.map(c => c.channelId);

      video = await Video.findOne({
        videoId: id,
        $or: [
          { userId: { $in: userIds } },
          { channelId: { $in: channelIds } }
        ]
      }).lean();
    }
    if (!video) {
      return res.json({
        video: {
          videoId: id,
          title: 'YouTube Action Feed',
          description: 'Analytics summary for the requested video/post.',
          publishedAt: new Date(),
          statistics: { viewCount: 0, likeCount: 0, commentCount: 0 },
          engagementRate: 0,
          likesHistory: []
        }
      });
    }
    res.json({ video });
  } catch (error) {
    logger.error(`Error in getVideoAnalytics: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const likeVideoDashboard = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Resolve organization users
    const filterUser = req.user.organizationId
      ? { $or: [{ organizationId: req.user.organizationId }, { _id: req.user.id }] }
      : { _id: req.user.id };
    const users = await User.find(filterUser).select('_id').lean();
    const userIds = users.map(u => u._id);

    // Resolve tenant channels to avoid cross-channel leakage
    const filterChannel = req.user.organizationId
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }] }
      : { userId: req.user.id };
    const channels = await Channel.find(filterChannel).select('channelId').lean();
    const channelIds = channels.map(c => c.channelId);

    const video = await Video.findOne({ userId: { $in: userIds }, channelId: { $in: channelIds }, videoId: id });
    if (!video) return res.status(404).json({ error: 'Video not found' });

    // Check if duplicate
    const hasLiked = video.likedByUsers && video.likedByUsers.some(id => id.toString() === userId.toString());
    if (hasLiked) {
      return res.status(400).json({ error: 'You have already liked this video' });
    }

    if (!video.likedByUsers) video.likedByUsers = [];
    video.likedByUsers.push(userId);

    if (!video.statistics) {
      video.statistics = { viewCount: 0, likeCount: 0, commentCount: 0 };
    }

    video.statistics.likeCount = (video.statistics.likeCount || 0) + 1;

    const viewCount = video.statistics.viewCount || 0;
    const likeCount = video.statistics.likeCount;
    const commentCount = video.statistics.commentCount || 0;
    video.engagementRate = viewCount > 0 ? parseFloat((((likeCount + commentCount) / viewCount) * 100).toFixed(2)) : 0;

    const todayStr = new Date().toISOString().split('T')[0];
    let history = video.likesHistory || [];
    if (history.length > 0) {
      const lastEntry = history[history.length - 1];
      const lastEntryDateStr = new Date(lastEntry.date).toISOString().split('T')[0];
      if (lastEntryDateStr === todayStr) {
        lastEntry.likeCount = likeCount;
      } else {
        history.push({ date: new Date(), likeCount });
      }
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      history = [
        { date: yesterday, likeCount: Math.max(0, likeCount - 1) },
        { date: new Date(), likeCount }
      ];
    }
    if (history.length > 30) history.shift();
    video.likesHistory = history;

    await video.save();

    res.json({
      success: true,
      statistics: video.statistics,
      engagementRate: video.engagementRate,
      likesHistory: video.likesHistory,
      likedByUsers: video.likedByUsers
    });
  } catch (error) {
    logger.error(`Error in likeVideoDashboard: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

const syncCommunityPostsForChannel = async (channel, userId) => {
  try {
    let scraped = [];
    if (channel.customUrl || channel.channelId) {
      scraped = await scrapeCommunityPosts(channel.customUrl, channel.channelId);
    }

    if (scraped && scraped.length > 0) {
      for (let i = 0; i < scraped.length; i++) {
        const p = scraped[i];
        const textHash = crypto.createHash('md5').update(p.text || '').digest('hex').substring(0, 12);
        const postId = p.postId || `yt_post_${channel.channelId}_${textHash}`;
        await Video.findOneAndUpdate(
          { channelId: channel.channelId, videoId: postId },
          {
            $set: {
              userId,
              channelId: channel.channelId,
              videoId: postId,
              title: (p.text || '').split('\n')[0] || 'Community Post',
              description: p.text,
              thumbnail: p.thumbnail || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=150',
              isPost: true,
              analyzed: true,
              statistics: { viewCount: 0, likeCount: 0, commentCount: 0 },
              lastFetchedAt: new Date()
            },
            $setOnInsert: {
              publishedAt: new Date()
            }
          },
          { upsert: true, returnDocument: 'after' }
        );
      }
    }
  } catch (err) {
    logger.error(`Error in syncCommunityPostsForChannel: ${err.message}`);
  }
};
