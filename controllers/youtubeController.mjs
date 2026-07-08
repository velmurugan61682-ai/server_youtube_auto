import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import Video from '../models/Video.mjs';
import User from '../models/User.mjs';
import logger from '../utils/logger.mjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import OAuthState from '../models/OAuthState.mjs';
import { 
  getYouTubeAuth, 
  getYouTubeClient, 
  getYouTubeClientWithApiKey, 
  fetchVideos,
  fetchPlaylists,
  getAuthFromClient,
  fetchVideoStatisticsBatch
} from '../services/youtubeService.mjs';
import { processComments } from '../services/commentProcessingService.mjs';
import { encrypt, decrypt } from '../utils/cryptoHelper.mjs';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

const activeRefreshes = new Set();

// ✅ FIX: Intelligent FRONTEND_URL selection based on NODE_ENV
const getFrontendUrl = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'https://client-youtube-automation.vercel.app';
    console.log(`[Frontend URL] Production mode - using: ${frontendUrl}`);
    return frontendUrl;
  } else {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    console.log(`[Frontend URL] Development mode - using: ${frontendUrl}`);
    return frontendUrl;
  }
};

const FRONTEND_URL = getFrontendUrl();

export const initiateAuth = async (req, res) => {
  try {
    const userId = req.user.id;
    const state = crypto.randomUUID();

    console.log(`[OAuth State Gen] ✅ Generated OAuth state for user ${userId}`);
    console.log(`[OAuth State Gen] State value: ${state}`);
    console.log(`[OAuth State Gen] TTL: 5 minutes`);

    // Store state mapping in MongoDB (TTL is 5 minutes as per schema)
    const stateDoc = await OAuthState.findOneAndUpdate(
      { state },
      { state, userId },
      { upsert: true, new: true }
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
  const { code, state, error: oauthError } = req.query;

  // ✅ FIX: Detailed logging for OAuth state debugging
  console.log(`[OAuth State Ver] Callback received:`);
  console.log(`  - State: ${state}`);
  console.log(`  - Code: ${code ? code.substring(0, 10) + '...' : 'MISSING'}`);
  console.log(`  - OAuth Error: ${oauthError || 'none'}`);
  console.log(`  - Full URL: ${req.originalUrl}`);

  if (oauthError) {
    logger.error(`[OAuth Error] Google OAuth error received: ${oauthError}`);
    return res.redirect(`${FRONTEND_URL}/?status=error&error=${encodeURIComponent(oauthError)}`);
  }

  if (!state) {
    logger.error('[OAuth Error] Missing state parameter from Google redirect');
    console.error('[OAuth Error] Missing state parameter - this is a critical OAuth security violation');
    return res.redirect(`${FRONTEND_URL}/?status=error&error=${encodeURIComponent('Missing state parameter')}`);
  }

  if (!code) {
    logger.error('[OAuth Error] Missing authorization code from Google');
    return res.redirect(`${FRONTEND_URL}/?status=error&error=${encodeURIComponent('Missing authorization code')}`);
  }

  // Look up and delete single-use state mapping
  let stateRecord = null;
  try {
    stateRecord = await OAuthState.findOneAndDelete({ state });
    if (!stateRecord) {
      console.log(`[OAuth State Ver] State record NOT found for state: ${state}`);
      console.log(`[OAuth State Ver] This could mean:`);
      console.log(`  1. State parameter was incorrect/tampered`);
      console.log(`  2. State expired (5-minute TTL)`);
      console.log(`  3. State was already used (single-use only)`);
      console.log(`  4. Database connection issue`);
      
      logger.error(`[OAuth Error] Invalid or expired OAuth state: ${state}`);
      return res.redirect(`${FRONTEND_URL}/?status=error&error=${encodeURIComponent('Invalid or expired state parameter')}`);
    }
    console.log(`[OAuth State Ver] ✅ State verified successfully for user: ${stateRecord.userId}`);
  } catch (dbErr) {
    logger.error(`[OAuth Error] Database error during state verification: ${dbErr.message}`);
    return res.redirect(`${FRONTEND_URL}/?status=error&error=${encodeURIComponent('Database error during verification')}`);
  }

  const userId = stateRecord.userId;

  let tokens = null;
  let channelRes = null;
  let channel = null;

  try {
    const user = await User.findById(userId);
    const client = getYouTubeAuth();
    logger.info(`Exchanging OAuth code: ${code ? code.substring(0, 10) + '...' : 'none'}`);
    const tokenResponse = await client.getToken(code);
    tokens = tokenResponse.tokens;
    client.setCredentials(tokens);
    logger.info('OAuth Token exchange successful');

    const youtube = getYouTubeClient(tokens, null, null);
    channelRes = await youtube.channels.list({ part: 'snippet,contentDetails,statistics', mine: true });
    const items = channelRes.data.items;

    if (!items || items.length === 0) {
      logger.error('YouTube Channel Response empty items');
      return res.status(400).json({ error: 'no_channel', message: 'No YouTube channel found' });
    }

    const channelData = items[0];
    let existingChannel = await Channel.findOne({ channelId: channelData.id });

    // Post-flight check: prevent Free Plan users from registering a second channel
    const isReconnectingOwnChannel = existingChannel && existingChannel.userId.toString() === userId.toString();
    if (!isReconnectingOwnChannel) {
      const isPremium = user && (user.subscription?.status === 'active' || user.subscription?.id === 'trial_promo_active' || user.role === 'admin');
      if (!isPremium) {
        const connectedChannelsCount = await Channel.countDocuments({ userId });
        if (connectedChannelsCount >= 1) {
          logger.warn(`Billing: User ${user?.email} blocked from connecting multiple channels on the Free Plan.`);
          return res.redirect(`${FRONTEND_URL}/?status=error&error=${encodeURIComponent('Free plan is limited to 1 YouTube channel. Please upgrade to Pro to connect multiple accounts.')}`);
        }
      }
    }

    const auth = getAuthFromClient(youtube);
    if (existingChannel && auth) {
      auth.channelDbId = existingChannel._id;
    }
    const uploadsPlaylistId = channelData.contentDetails?.relatedPlaylists?.uploads || '';

    // Fetch all playlists for the channel
    const playlists = await fetchPlaylists(youtube, channelData.id);

    const updateData = {
      userId,
      organizationId: user?.organizationId || null,
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
    logger.info(`Channel saved to MongoDB: ${channel.title} (ID: ${channel.channelId})`);

    // Trigger initial background process (processComments expects raw/decrypted tokens)
    const io = req.app.get('io');
    processComments(channel, tokens, null, io).catch(err => 
      logger.error('Initial processComments error:', err)
    );

    res.redirect(`${FRONTEND_URL}/?status=success&channelId=${channel.channelId}`);
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

    res.status(500).json({
      error: 'auth_failed',
      message: error.message,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue
    });
  }
};

export const getChannels = async (req, res) => {
  try {
    const filter = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }] }
      : { userId: req.user.id };
    const channels = await Channel.find(filter).select('title channelId thumbnailUrl apiKey reconnectRequired reconnectReason');
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
    
    const filter = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }], channelId }
      : { userId: req.user.id, channelId };
    const channel = await Channel.findOne(filter);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    let videos = await Video.find({ channelId }).sort({ publishedAt: -1 });

    const staleTime = Date.now() - 60000; // 60 seconds TTL cache
    const needsStatsRefresh = videos.length > 0 && (
      videos.some(v => !v.lastFetchedAt || !v.statistics || typeof v.statistics.viewCount !== 'number' || v.lastFetchedAt.getTime() < staleTime)
    );

    if (needsStatsRefresh) {
      const refreshKey = `${req.user.id}_${channelId}`;
      if (activeRefreshes.has(refreshKey)) {
        logger.info(`[SYNC] Refresh already in progress for channel: ${channelId} (User: ${req.user.id}). Returning cached DB videos.`);
      } else {
        activeRefreshes.add(refreshKey);
        logger.info(`Stale/missing statistics detected for channel: ${channelId}. Syncing from YouTube Data API...`);
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

          const videoIds = videos.map(v => v.videoId);
          const apiStatsItems = await fetchVideoStatisticsBatch(youtube, videoIds);

          const todayStr = new Date().toISOString().split('T')[0];

          for (const item of apiStatsItems) {
            const viewCount = parseInt(item.statistics?.viewCount || 0);
            const likeCount = parseInt(item.statistics?.likeCount || 0);
            const commentCount = parseInt(item.statistics?.commentCount || 0);
            const engagementRate = viewCount > 0 ? parseFloat((((likeCount + commentCount) / viewCount) * 100).toFixed(2)) : 0;

            const video = videos.find(v => v.videoId === item.id);
            if (video) {
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

              await Video.updateOne(
                { _id: video._id },
                {
                  $set: {
                    statistics: { viewCount, likeCount, commentCount },
                    engagementRate,
                    likesHistory: history,
                    lastFetchedAt: new Date()
                  }
                }
              );
            }
          }
          
          // Re-fetch updated list
          videos = await Video.find({ userId: req.user.id, channelId }).sort({ publishedAt: -1 });
        } catch (apiErr) {
          logger.error(`YouTube API refresh failed, returning stale MongoDB videos: ${apiErr.message}`);
        } finally {
          activeRefreshes.delete(refreshKey);
        }
      }
    }
    
    res.json({ videos });
  } catch (error) {
    logger.error(`Error in getVideos: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const getVideoAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const video = await Video.findOne({ userId: req.user.id, videoId: id });
    if (!video) return res.status(404).json({ error: 'Video not found' });
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
    
    const video = await Video.findOne({ userId, videoId: id });
    if (!video) return res.status(404).json({ error: 'Video not found' });
    
    // Check if duplicate
    if (video.likedByUsers && video.likedByUsers.includes(userId)) {
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
