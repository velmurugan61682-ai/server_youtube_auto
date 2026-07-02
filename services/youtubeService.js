import { google } from 'googleapis';
import logger from '../utils/logger.mjs';

/**
 * Creates and returns an OAuth2 client configured with environment variables.
 * 
 * @returns {object} google.auth.OAuth2 client
 */
export const getOAuth2Client = () => {
  const clientId = (process.env.YOUTUBE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '');
  const clientSecret = (process.env.YOUTUBE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '').trim().replace(/^["']|["']$/g, '');
  const redirectUri = (process.env.REDIRECT_URI || 'http://localhost:5000/auth/google/callback').trim().replace(/^["']|["']$/g, '');
  const refreshToken = (process.env.YOUTUBE_OAUTH_REFRESH_TOKEN || '').trim().replace(/^["']|["']$/g, '');

  if (!clientId || !clientSecret) {
    throw new Error('OAuth2 credentials (YOUTUBE_OAUTH_CLIENT_ID/GOOGLE_CLIENT_ID and YOUTUBE_OAUTH_CLIENT_SECRET/GOOGLE_CLIENT_SECRET) must be set in environment variables.');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  if (refreshToken) {
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
  } else {
    logger.warn('[YouTube Service] YOUTUBE_OAUTH_REFRESH_TOKEN is missing in the environment. Writing actions will fail.');
  }

  return oauth2Client;
};

/**
 * Checks if a YouTube API error is a quota exhaustion error.
 * 
 * @param {Error} error 
 * @returns {boolean}
 */
export const isQuotaError = (error) => {
  if (!error) return false;
  const msg = error.response?.data?.error?.message || error.message || '';
  const reason = error.response?.data?.error?.errors?.[0]?.reason || '';
  return msg.includes('quotaExceeded') || msg.includes('exceeded your quota') || reason === 'quotaExceeded';
};

/**
 * Executes a function with exponential backoff retry logic.
 * Bypasses retry if a YouTube API Quota error is encountered.
 * 
 * @param {Function} fn - Async function to run
 * @param {number} retries - Number of retries remaining
 * @param {number} delay - Initial delay in milliseconds
 * @returns {Promise<any>}
 */
export const runWithRetry = async (fn, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (isQuotaError(error)) {
      logger.error('[YouTube Service] YouTube Quota Exceeded. Aborting retries.');
      throw error;
    }

    const statusCode = error.response?.status;
    const isTransientError = !statusCode || statusCode === 429 || (statusCode >= 500 && statusCode < 600);

    if (isTransientError && retries > 0) {
      logger.warn(`[YouTube Service] Transient API error: ${error.message}. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return runWithRetry(fn, retries - 1, delay * 2);
    }

    throw error;
  }
};

/**
 * Fetches the latest comment threads for the channel configured in YOUTUBE_CHANNEL_ID.
 * 
 * @param {number} maxResults 
 * @returns {Promise<Array>} Array of comment threads
 */
export const fetchLatestCommentThreads = async (maxResults = 20) => {
  const channelId = (process.env.YOUTUBE_CHANNEL_ID || '').trim().replace(/^["']|["']$/g, '');
  if (!channelId) {
    throw new Error('YOUTUBE_CHANNEL_ID is not defined in the environment.');
  }

  const auth = getOAuth2Client();
  const youtube = google.youtube({ version: 'v3', auth });

  return runWithRetry(async () => {
    logger.info(`[YouTube Service] Fetching latest comment threads for channel ID: ${channelId}...`);
    const response = await youtube.commentThreads.list({
      part: 'snippet,replies',
      allThreadsRelatedToChannelId: channelId,
      maxResults,
      order: 'time'
    });

    return response.data.items || [];
  });
};

/**
 * Replies to a parent comment thread by parent ID.
 * 
 * @param {string} parentId - Top-level comment thread ID
 * @param {string} replyText - The reply content
 * @returns {Promise<object>} Response data
 */
export const insertCommentReply = async (parentId, replyText) => {
  const auth = getOAuth2Client();
  const youtube = google.youtube({ version: 'v3', auth });

  return runWithRetry(async () => {
    logger.info(`[YouTube Service] Inserting reply to parent comment ID: ${parentId}`);
    const response = await youtube.comments.insert({
      part: 'snippet',
      resource: {
        snippet: {
          parentId,
          textOriginal: replyText
        }
      }
    });

    return response.data;
  });
};

/**
 * Moderates a comment by setting its moderation status.
 * 
 * @param {string} commentId 
 * @param {string} status - 'rejected' (to delete/remove) or 'heldForReview' (to hide/hold)
 * @returns {Promise<object>} Response data
 */
export const setCommentModeration = async (commentId, status) => {
  if (status !== 'rejected' && status !== 'heldForReview') {
    throw new Error(`Invalid moderation status specified: ${status}`);
  }

  const auth = getOAuth2Client();
  const youtube = google.youtube({ version: 'v3', auth });

  return runWithRetry(async () => {
    logger.info(`[YouTube Service] Setting moderation status for comment ID: ${commentId} to "${status}"`);
    const response = await youtube.comments.setModerationStatus({
      id: [commentId],
      moderationStatus: status
    });

    return response.data;
  });
};

/**
 * Fetches the snippet (title and description) of a YouTube video by ID.
 * 
 * @param {string} videoId 
 * @returns {Promise<{title: string, description: string} | null>}
 */
export const fetchVideoDetails = async (videoId) => {
  if (!videoId) return null;

  const auth = getOAuth2Client();
  const youtube = google.youtube({ version: 'v3', auth });

  return runWithRetry(async () => {
    logger.info(`[YouTube Service] Fetching details for video ID: ${videoId}`);
    const response = await youtube.videos.list({
      part: 'snippet',
      id: videoId
    });

    const item = response.data.items?.[0];
    if (item) {
      return {
        title: item.snippet.title,
        description: item.snippet.description
      };
    }

    logger.warn(`[YouTube Service] No video details found for video ID: ${videoId}`);
    return null;
  });
};
