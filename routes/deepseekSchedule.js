import express from 'express';
import cron from 'node-cron';
import ScheduledUpload from '../models/ScheduledUpload.mjs';
import Channel from '../models/Channel.mjs';
import { getYouTubeClient, ensureAuthToken } from '../services/youtubeService.mjs';
import { decrypt } from '../utils/cryptoHelper.mjs';
import { google } from 'googleapis';
import axios from 'axios';
import logger from '../utils/logger.mjs';
import { authMiddleware } from '../middleware/auth.mjs';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import os from 'os';

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB limit
});

const router = express.Router();

/**
 * Helper to query YouTube Analytics API or return fallback watch-time data.
 */
const getWatchTimeData = async (youtubeAuth, channelId) => {
  try {
    const analytics = google.youtubeAnalytics({ version: 'v2', auth: youtubeAuth });
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const formatDate = (date) => date.toISOString().split('T')[0];

    logger.info(`[Auto-Schedule] Requesting YouTube Analytics reports.query for channel: ${channelId}`);
    const response = await analytics.reports.query({
      ids: `channel==${channelId}`,
      startDate: formatDate(thirtyDaysAgo),
      endDate: formatDate(today),
      metrics: 'views,estimatedMinutesWatched',
      dimensions: 'hour'
    });

    if (response.data && response.data.rows) {
      logger.info(`[Auto-Schedule] YouTube Analytics reports.query returned ${response.data.rows.length} rows.`);
      return response.data.rows.map(row => ({
        hour: parseInt(row[0]),
        views: parseInt(row[1]),
        estimatedMinutesWatched: parseInt(row[2])
      }));
    }
    throw new Error('Empty rows returned from YouTube Analytics');
  } catch (error) {
    logger.warn(`[Auto-Schedule] Failed to fetch real YouTube Analytics watch time data: ${error.message}. Using default hourly watch-time distribution fallback.`);
    // Return standard fallback distribution (higher watch time in the evening 18:00 - 22:00)
    return Array.from({ length: 24 }, (_, hour) => {
      let weight = 0.5;
      if (hour >= 18 && hour <= 22) weight = 0.9;
      else if (hour >= 12 && hour <= 17) weight = 0.7;
      else if (hour >= 0 && hour <= 5) weight = 0.2;
      return { hour, estimatedMinutesWatched: Math.round(weight * 100) };
    });
  }
};

/**
 * POST /api/deepseek/upload-video
 */
router.post('/upload-video', authMiddleware, upload.single('video'), async (req, res) => {
  req.setTimeout(30 * 60 * 1000); // 30 minutes
  res.setTimeout(30 * 60 * 1000); // 30 minutes

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  const { channelId, title, description } = req.body;
  if (!channelId) {
    if (file.path && fs.existsSync(file.path)) {
      try { await fs.promises.unlink(file.path); } catch (e) {}
    }
    return res.status(400).json({ error: 'channelId is required' });
  }

  try {
    const filter = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }], channelId }
      : { userId: req.user.id, channelId };
    const channel = await Channel.findOne(filter);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Initialize YouTube client
    const decryptedTokens = {
      access_token: decrypt(channel.accessToken),
      refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
      expiry_date: channel.expiryDate
    };
    const youtube = getYouTubeClient(decryptedTokens, null, channel._id);
    const auth = youtube.context?._options?.auth || youtube.auth;

    // Refresh if needed
    await ensureAuthToken(auth, channel._id);

    logger.info(`[Auto-Schedule Upload] Starting resumable upload of ${file.originalname} to YouTube channel: ${channelId}`);

    // Call youtube.videos.insert with resumable upload
    const insertRes = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title: title || path.basename(file.originalname, path.extname(file.originalname)).replace(/[_-]/g, ' '),
          description: description || 'Uploaded and scheduled automatically by AI agent.'
        },
        status: {
          privacyStatus: 'private'
        }
      },
      media: {
        body: fs.createReadStream(file.path)
      }
    });

    // Clean up local temp file
    if (fs.existsSync(file.path)) {
      await fs.promises.unlink(file.path);
    }

    if (insertRes.data && insertRes.data.id) {
      logger.info(`[Auto-Schedule Upload] Resumable upload complete. Video ID: ${insertRes.data.id}`);
      return res.json({ videoId: insertRes.data.id, title: insertRes.data.snippet?.title || title });
    } else {
      throw new Error('YouTube API insert call did not return a valid video ID.');
    }
  } catch (error) {
    logger.error(`[Auto-Schedule Upload] Resumable upload failed: ${error.message}`);
    // Clean up local temp file even on failure
    if (file.path && fs.existsSync(file.path)) {
      try {
        await fs.promises.unlink(file.path);
      } catch (unlinkErr) {
        logger.error(`[Auto-Schedule Upload] Failed to delete temp file on error: ${unlinkErr.message}`);
      }
    }
    return res.status(500).json({ error: error.message || 'Resumable upload failed' });
  }
});

/**
 * POST /api/deepseek/analyze-schedule
 */
router.post('/analyze-schedule', authMiddleware, async (req, res) => {
  try {
    const { channelId, videoId } = req.body;
    if (!channelId) {
      return res.status(400).json({ error: 'channelId is required' });
    }
    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }

    const filter = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }], channelId }
      : { userId: req.user.id, channelId };
    const channel = await Channel.findOne(filter);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Initialize YouTube Auth client to fetch metrics
    const decryptedTokens = {
      access_token: decrypt(channel.accessToken),
      refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
      expiry_date: channel.expiryDate
    };
    const youtube = getYouTubeClient(decryptedTokens, null, channel._id);
    const youtubeAuth = youtube.context?._options?.auth || youtube.auth;

    // Refresh token if needed
    await ensureAuthToken(youtubeAuth, channel._id);

    // Fetch video snippet directly from YouTube
    const videoListResponse = await youtube.videos.list({
      id: videoId,
      part: 'snippet'
    });

    const videoItem = videoListResponse.data?.items?.[0];
    if (!videoItem) {
      return res.status(404).json({ error: `Video with ID ${videoId} not found on YouTube.` });
    }

    const title = videoItem.snippet?.title || '';
    const description = videoItem.snippet?.description || '';

    // Get watch time data
    const watchTimeData = await getWatchTimeData(youtubeAuth, channelId);

    // Call DeepSeek API
    const apiKey = (process.env.DEEPSEEK_API_KEY || '').trim().replace(/^["']|["']$/g, '');
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not defined in the environment.');
    }

    const systemPrompt = `You are a YouTube publishing optimization expert.
Analyze the channel's hourly watch-time/view data to recommend the absolute best date and time in ISO 8601 format to publish a new video.
You must return a JSON object with this exact schema:
{
  "recommended_datetime_iso": "YYYY-MM-DDTHH:mm:ss.sssZ",
  "reason": "A one-line explanation of why this time was recommended based on the watch time data."
}
Rules:
- The recommended time must be in the future (within the next 7 days).
- Respond with ONLY valid JSON. No markdown, no HTML, no explanation outside the JSON.`;

    const userMessage = `Video Title: "${title || 'Untitled Video'}"
Video Description: "${description || ''}"
Hourly Watch-time Data: ${JSON.stringify(watchTimeData)}`;

    let content = '';
    try {
      logger.info(`[Auto-Schedule] Calling DeepSeek to analyze best schedule...`);
      const deepseekResponse = await axios.post(
        'https://api.deepseek.com/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 25000
        }
      );
      content = deepseekResponse.data?.choices?.[0]?.message?.content || '';
    } catch (apiErr) {
      logger.error(`[Auto-Schedule] DeepSeek API call failed: ${apiErr.message}. Falling back to default scheduling.`);
    }

    let parsed = null;
    if (content) {
      // Strip markdown fences
      content = content.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        parsed = JSON.parse(content);
      } catch (parseErr) {
        logger.error(`[Auto-Schedule] Failed to parse DeepSeek response: "${content}"`);
      }
    }

    // Sane fallback: 2 hours from now
    let recommendedTime = new Date();
    recommendedTime.setHours(recommendedTime.getHours() + 2);
    let reason = 'Fallback: Scheduled 2 hours from now due to AI analysis timeout/error.';

    if (parsed && parsed.recommended_datetime_iso) {
      const parsedDate = new Date(parsed.recommended_datetime_iso);
      if (!isNaN(parsedDate.getTime()) && parsedDate.getTime() > Date.now()) {
        recommendedTime = parsedDate;
        reason = parsed.reason || 'Optimal publishing time recommended by Deepseek.';
      }
    }

    // Save scheduled upload in MongoDB
    const scheduledUpload = await ScheduledUpload.create({
      videoId,
      fileName: null,
      channelId,
      mode: 'auto',
      scheduledTime: recommendedTime,
      reason,
      status: 'scheduled'
    });

    logger.info(`[Auto-Schedule] Created auto scheduled upload for channel ${channelId} at ${recommendedTime.toISOString()}`);
    res.json(scheduledUpload);
  } catch (error) {
    logger.error(`[Auto-Schedule] Error in analyze-schedule: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/deepseek/confirm-schedule
 */
router.post('/confirm-schedule', authMiddleware, async (req, res) => {
  try {
    const { channelId, videoId, scheduledTime } = req.body;
    if (!channelId || !scheduledTime || !videoId) {
      return res.status(400).json({ error: 'channelId, videoId, and scheduledTime are required' });
    }
    const filter = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }], channelId }
      : { userId: req.user.id, channelId };
    const channel = await Channel.findOne(filter);
    if (!channel) {
      return res.status(403).json({ error: 'Access denied: Channel not found or unauthorized.' });
    }

    const scheduledUpload = await ScheduledUpload.create({
      videoId,
      fileName: null,
      channelId,
      mode: 'manual',
      scheduledTime: new Date(scheduledTime),
      reason: 'Manually scheduled by creator',
      status: 'scheduled'
    });

    logger.info(`[Auto-Schedule] Created manual scheduled upload for channel ${channelId} at ${scheduledTime}`);
    res.json(scheduledUpload);
  } catch (error) {
    logger.error(`[Auto-Schedule] Error in confirm-schedule: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});


/**
 * @route GET /api/deepseek/schedule-queue
 */
router.get('/schedule-queue', authMiddleware, async (req, res) => {
  try {
    const { channelId } = req.query;

    const userFilter = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }] }
      : { userId: req.user.id };
    const channels = await Channel.find(userFilter).select('channelId');
    const channelIds = channels.map(c => c.channelId);

    const filter = { channelId: { $in: channelIds } };
    if (channelId) {
      if (channelIds.includes(channelId)) {
        filter.channelId = channelId;
      } else {
        return res.json([]);
      }
    }
    const queue = await ScheduledUpload.find(filter).sort({ scheduledTime: 1 });
    res.json(queue);
  } catch (error) {
    logger.error(`[Auto-Schedule] Error in schedule-queue: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * node-cron publishing job: Runs every minute
 */
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    // Find scheduled uploads where publish time is in the past
    const pendingUploads = await ScheduledUpload.find({
      status: 'scheduled',
      scheduledTime: { $lte: now }
    });

    if (pendingUploads.length === 0) return;

    logger.info(`[Auto-Schedule Cron] Found ${pendingUploads.length} scheduled uploads to publish.`);

    for (const upload of pendingUploads) {
      // Optimistic lock: atomically flip to 'publishing' BEFORE calling the YouTube API
      const lockedUpload = await ScheduledUpload.findOneAndUpdate(
        { _id: upload._id, status: 'scheduled' },
        { $set: { status: 'publishing' } },
        { new: true }
      );

      if (!lockedUpload) {
        logger.info(`[Auto-Schedule Cron] Upload ${upload._id} already claimed by another cron. Skipping.`);
        continue;
      }

      logger.info(`[Auto-Schedule Cron] Processing publish for upload ID ${lockedUpload._id}`);

      try {
        const channel = await Channel.findOne({ channelId: lockedUpload.channelId });
        if (!channel) {
          throw new Error(`Connected YouTube channel record not found for ID: ${lockedUpload.channelId}`);
        }

        // Initialize YouTube client
        const decryptedTokens = {
          access_token: decrypt(channel.accessToken),
          refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
          expiry_date: channel.expiryDate
        };
        const youtube = getYouTubeClient(decryptedTokens, null, channel._id);
        const auth = youtube.context?._options?.auth || youtube.auth;

        // Refresh if needed
        await ensureAuthToken(auth, channel._id);

        if (!lockedUpload.videoId) {
          throw new Error('Invalid scheduled upload record: videoId is required.');
        }

        logger.info(`[Auto-Schedule Cron] Flipping videoId ${lockedUpload.videoId} privacy to public`);
        
        await youtube.videos.update({
          part: 'status',
          requestBody: {
            id: lockedUpload.videoId,
            status: {
              privacyStatus: 'public'
            }
          }
        });

        lockedUpload.status = 'published';
        lockedUpload.errorMessage = null;
        await lockedUpload.save();
        logger.info(`[Auto-Schedule Cron] Successfully published scheduled upload ${lockedUpload._id}`);
      } catch (err) {
        logger.error(`[Auto-Schedule Cron] Failed to publish upload ${lockedUpload._id}: ${err.message}`);
        lockedUpload.status = 'failed';
        lockedUpload.errorMessage = err.message;
        await lockedUpload.save();
      }
    }
  } catch (cronErr) {
    logger.error(`[Auto-Schedule Cron] Global cron execution error: ${cronErr.message}`);
  }
});

export default router;
