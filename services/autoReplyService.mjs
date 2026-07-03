import OpenAI from 'openai';
import logger from '../utils/logger.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import { replyToComment } from './youtubeService.mjs';
import { google } from 'googleapis';

/**
 * Creates and returns an OAuth2 client configured with environment variables
 * for fallback system-wide comment replies.
 */
const getOAuth2Client = () => {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '');
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim().replace(/^["']|["']$/g, '');
  const redirectUri = (process.env.GOOGLE_REDIRECT_URI || process.env.REDIRECT_URI || 'http://localhost:5000/api/youtube/callback').trim().replace(/^["']|["']$/g, '');
  const refreshToken = (process.env.YOUTUBE_OAUTH_REFRESH_TOKEN || '').trim().replace(/^["']|["']$/g, '');

  console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);

  if (!clientId || !clientSecret) {
    throw new Error('OAuth2 credentials (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) must be set in environment variables.');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  if (refreshToken) {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
  }
  return oauth2Client;
};

/**
 * Automatically generates a context-aware reply using DeepSeek in the original language
 * and script of the comment, posts it on YouTube, and logs the transaction.
 * 
 * @param {object} params
 * @param {object} [params.youtube] - Authenticated YouTube client instance (optional)
 * @param {string} params.parentId - Target comment thread/parent ID
 * @param {string} params.commentText - Text of the comment to reply to
 * @param {string} params.commentId - YouTube comment ID (for audit log)
 * @param {string} params.videoId - YouTube video ID (for audit log)
 * @param {string} [params.userId] - User ID who owns the channel (for audit log)
 * @param {string} [params.userKey] - Custom OpenAI/DeepSeek key (optional)
 * @returns {Promise<{success: boolean, replyText?: string, detectedLanguage?: string, reason?: string}>}
 */
export const generateAndPostAutoReply = async ({
  youtube,
  parentId,
  commentText,
  commentId,
  videoId,
  userId,
  userKey = null
}) => {
  logger.info(`[Auto-Reply Service] Initiating auto-reply flow for comment: "${commentText}" (ID: ${commentId})`);

  // 1. Resolve DeepSeek API Key and OpenAI client
  let apiKey = userKey;
  if (!apiKey) {
    const rawKey = process.env.DEEPSEEK_API_KEY || '';
    apiKey = rawKey.trim().replace(/^["']|["']$/g, '');
  }

  if (!apiKey) {
    logger.error('[Auto-Reply Service] DeepSeek API Key is missing. Skipping auto-reply.');
    return { success: false, reason: 'DeepSeek API Key is missing.' };
  }

  let client;
  try {
    client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com'
    });
  } catch (err) {
    logger.error('[Auto-Reply Service] Failed to initialize OpenAI client for DeepSeek:', err);
    return { success: false, reason: `Client initialization failed: ${err.message}` };
  }

  // 2. Generate Reply using DeepSeek
  let detectedLanguage = 'unknown';
  let replyText = '';

  try {
    const prompt = `You are replying to a YouTube comment on behalf of the channel owner.
Comment: "${commentText}"

First, analyze and detect the language of the comment (e.g., Tamil, English, Hindi, Tanglish, etc.).
Then, generate a natural, relevant, warm, and friendly reply in the exact SAME language and script as the comment. Keep the reply short (1-2 sentences), warm, and relevant to what the commenter said. Do not use generic or templated replies.

Respond with ONLY a JSON object (no markdown, no other text) in this format:
{
  "detectedLanguage": "detected language here",
  "reply": "generated reply text here"
}`;

    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      timeout: 25000 // 25 seconds timeout
    });

    const rawContent = response.choices[0].message.content.trim();
    logger.info(`[Auto-Reply Service] Raw DeepSeek response: ${rawContent}`);

    let parsed = JSON.parse(rawContent);
    detectedLanguage = parsed.detectedLanguage || 'unknown';
    replyText = parsed.reply || '';
  } catch (err) {
    logger.error(`[Auto-Reply Service] DeepSeek API call failed for comment ${commentId}:`, err);
    return { success: false, reason: `DeepSeek generation failed: ${err.message}` };
  }

  if (!replyText) {
    logger.warn(`[Auto-Reply Service] Empty reply text generated for comment ${commentId}. Skipping.`);
    return { success: false, reason: 'Empty reply text generated' };
  }

  // 3. Post reply using YouTube API
  let activeYoutube = youtube;
  if (!activeYoutube) {
    try {
      const auth = getOAuth2Client();
      activeYoutube = google.youtube({ version: 'v3', auth });
    } catch (err) {
      logger.error(`[Auto-Reply Service] Failed to get YouTube client for comment ${commentId}:`, err);
      return { success: false, reason: `Failed to initialize YouTube client: ${err.message}` };
    }
  }

  logger.info(`[Auto-Reply Service] Posting reply to comment ${parentId}: "${replyText}"`);

  let postSuccess = false;
  let errorReason = null;

  try {
    let repRes;
    if (youtube) {
      repRes = await replyToComment(youtube, parentId, replyText);
    } else {
      // Use fallback system client insertion
      const response = await activeYoutube.comments.insert({
        part: 'snippet',
        resource: {
          snippet: {
            parentId,
            textOriginal: replyText
          }
        }
      });
      logger.info(`[Auto-Reply Service] System client comments.insert succeeded with status ${response.status}.`);
      repRes = { success: true };
    }

    if (repRes.success) {
      postSuccess = true;
    } else {
      errorReason = repRes.reason || 'Unknown error';
    }
  } catch (err) {
    logger.error(`[Auto-Reply Service] Failed to post reply to YouTube:`, err);
    errorReason = err.message;
  }

  if (postSuccess) {
    logger.info(`[Auto-Reply Service] Auto-reply posted successfully for comment ${commentId}`);

    // 4. Log the audit entry in MongoDB
    try {
      const auditLog = new AutoReplyLog({
        commentId,
        videoId,
        userId: userId || null,
        detectedLanguage,
        replyText,
        timestamp: new Date()
      });
      await auditLog.save();
      logger.info(`[Auto-Reply Service] Audit log saved successfully for comment ${commentId}`);
    } catch (dbErr) {
      logger.error(`[Auto-Reply Service] Failed to save audit log:`, dbErr);
    }

    return { success: true, replyText, detectedLanguage };
  } else {
    logger.error(`[Auto-Reply Service] Failed to post auto-reply: ${errorReason}`);
    return { success: false, reason: errorReason, replyText }; // Return replyText so suggestedReply can be saved on failure
  }
};
