import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import Video from '../models/Video.mjs';
import logger from '../utils/logger.mjs';
import jwt from 'jsonwebtoken';
import { 
  getYouTubeAuth, 
  getYouTubeClient, 
  getYouTubeClientWithApiKey, 
  fetchVideos,
  fetchPlaylists
} from '../services/youtubeService.mjs';
import { processComments } from '../services/commentProcessingService.mjs';
import { encrypt, decrypt } from '../utils/cryptoHelper.mjs';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export const initiateAuth = (_req, res) => {
  try {
    const client = getYouTubeAuth();
    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.force-ssl'
      ],
    });
    res.redirect(authUrl);
  } catch (err) {
    logger.error(`Failed to generate OAuth URL: ${err.message}`);
    res.status(500).json({ error: 'OAuth Configuration Error' });
  }
};

export const handleCallback = async (req, res) => {
  const { code, error: oauthError } = req.query;

  if (oauthError) return res.redirect(`${FRONTEND_URL}/?error=access_denied`);

  const token = req.cookies.token;
  if (!token) return res.redirect(`${FRONTEND_URL}/?error=unauthorized`);

  let userId;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    userId = decoded.id;
  } catch (err) {
    return res.redirect(`${FRONTEND_URL}/?error=invalid_session`);
  }

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

    const youtube = getYouTubeClient(tokens);
    channelRes = await youtube.channels.list({ part: 'snippet,contentDetails,statistics', mine: true });
    const items = channelRes.data.items;

    if (!items || items.length === 0) {
      logger.error('YouTube Channel Response empty items');
      return res.redirect(`${FRONTEND_URL}/?error=no_channel`);
    }

    const channelData = items[0];
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
      statistics: {
        subscriberCount: channelData.statistics?.subscriberCount || '0',
        videoCount: channelData.statistics?.videoCount || '0',
        viewCount: channelData.statistics?.viewCount || '0',
      }
    };

    if (tokens.refresh_token) updateData.refreshToken = encrypt(tokens.refresh_token);
    if (tokens.expiry_date) updateData.expiryDate = tokens.expiry_date;

    channel = await Channel.findOneAndUpdate(
      { channelId: channelData.id },
      { $set: updateData },
      { upsert: true, new: true }
    );
    logger.info(`Channel saved to MongoDB: ${channel.title} (ID: ${channel.channelId})`);

    // Trigger initial background process (processComments expects raw/decrypted tokens)
    const io = req.app.get('io');
    processComments(channel, tokens, null, io).catch(err => 
      logger.error('Initial processComments error:', err)
    );

    res.redirect(`${FRONTEND_URL}/?status=success`);
  } catch (error) {
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
    res.redirect(`${FRONTEND_URL}/?error=auth_failed&message=${encodeURIComponent(error.message)}`);
  }
};

export const getChannels = async (req, res) => {
  try {
    const channels = await Channel.find({ userId: req.user.id }).select('title channelId thumbnailUrl apiKey');
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

    // Fetch videos from MongoDB to prevent YouTube API quota limit exhaustion and load them instantly
    logger.info(`Fetching videos from MongoDB for channel: ${channelId}`);
    const videos = await Video.find({ userId: req.user.id, channelId }).sort({ publishedAt: -1 });
    
    res.json({ videos });
  } catch (error) {
    logger.error(`Error in getVideos: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};
