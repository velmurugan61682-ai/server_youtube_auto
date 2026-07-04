import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import Video from '../models/Video.mjs';
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
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export const initiateAuth = async (req, res) => {
  try {
    const userId = req.user.id;
    const state = crypto.randomUUID();

    console.log(`[OAuth State Gen] Generating OAuth state for user ${userId}: ${state}`);

    // Store state mapping in MongoDB (TTL is 5 minutes as per schema)
    await OAuthState.findOneAndUpdate(
      { state },
      { state, userId },
      { upsert: true, new: true }
    );

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
    res.json({ redirectUrl: authUrl });
  } catch (err) {
    logger.error(`Failed to generate OAuth URL: ${err.message}`);
    res.status(500).json({ error: 'OAuth Configuration Error' });
  }
};

export const handleCallback = async (req, res) => {
  const { code, state, error: oauthError } = req.query;

  console.log(`[OAuth State Ver] Received callback with state: ${state}, code: ${code ? 'exists' : 'none'}, error: ${oauthError || 'none'}`);

  if (oauthError) return res.status(400).json({ error: 'access_denied', message: oauthError });

  if (!state) {
    logger.error('handleCallback: Missing state parameter from Google redirect');
    return res.status(400).json({ error: 'invalid_state', message: 'Missing state parameter' });
  }

  // Look up and delete single-use state mapping
  const stateRecord = await OAuthState.findOneAndDelete({ state });
  if (!stateRecord) {
    console.log(`[OAuth State Ver] State record not found or expired for state: ${state}`);
    logger.error('handleCallback: Invalid or expired OAuth state parameter');
    return res.status(400).json({ error: 'invalid_state', message: 'Invalid or expired state parameter' });
  }

  const userId = stateRecord.userId;

  let tokens = null;
  let channelRes = null;
  let channel = null;

  try {
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
    const auth = getAuthFromClient(youtube);
    if (existingChannel && auth) {
      auth.channelDbId = existingChannel._id;
    }
    const uploadsPlaylistId = channelData.contentDetails?.relatedPlaylists?.uploads || '';

    // Fetch all playlists for the channel
    const playlists = await fetchPlaylists(youtube, channelData.id);

    const updateData = {
      userId,
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
    const channels = await Channel.find({ userId: req.user.id }).select('title channelId thumbnailUrl apiKey reconnectRequired reconnectReason');
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const deletedChannel = await Channel.findOneAndDelete({ userId: req.user.id, channelId });
    if (!deletedChannel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    await Comment.deleteMany({ userId: req.user.id, channelId });
    res.json({ success: true, message: 'Channel disconnected' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect channel' });
  }
};

export const getVideos = async (req, res) => {
  try {
    const { channelId } = req.query;
    if (!channelId) return res.status(400).json({ error: 'channelId is required' });
    
    const channel = await Channel.findOne({ userId: req.user.id, channelId });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    // Fetch videos from MongoDB
    logger.info(`Fetching videos from MongoDB for channel: ${channelId}`);
    let videos = await Video.find({ userId: req.user.id, channelId }).sort({ publishedAt: -1 });

    const staleTime = Date.now() - 60000; // 60 seconds TTL cache
    const needsStatsRefresh = videos.length > 0 && (
      videos.some(v => !v.lastFetchedAt || !v.statistics || !v.statistics.viewCount || v.lastFetchedAt.getTime() < staleTime)
    );

    if (needsStatsRefresh) {
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
