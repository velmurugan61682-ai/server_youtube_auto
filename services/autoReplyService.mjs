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
  const redirectUri = (process.env.GOOGLE_REDIRECT_URI || process.env.REDIRECT_URI || 'https://server-youtube-automation.onrender.com/api/youtube/callback').trim().replace(/^["']|["']$/g, '');
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

  // 1. Idempotency check: Verify if we have already posted a reply to this comment ID
  try {
    const existingReply = await AutoReplyLog.findOne({ commentId });
    if (existingReply) {
      if (existingReply.status === 'success' || existingReply.status === 'pending') {
        logger.warn(`[Auto-Reply Service] A reply has already been logged/pending for comment ID ${commentId}. Skipping duplicate post.`);
        return { 
          success: true, 
          replyText: existingReply.replyText, 
          detectedLanguage: existingReply.detectedLanguage,
          alreadyReplied: true 
        };
      }
    }
  } catch (err) {
    logger.error(`[Auto-Reply Service] Idempotency check failed: ${err.message}`);
  }

  // 2. Perform atomic insert in AutoReplyLog to acquire the reply lock
  let auditLog;
  try {
    auditLog = new AutoReplyLog({
      commentId,
      videoId,
      userId: userId || null,
      detectedLanguage: 'pending',
      replyText: 'pending',
      status: 'pending',
      timestamp: new Date()
    });
    await auditLog.save();
    logger.info(`[Auto-Reply Service] Reply lock acquired successfully in AutoReplyLog for comment ${commentId}`);
  } catch (dbErr) {
    // If unique index constraint is violated (code 11000)
    if (dbErr.code === 11000) {
      logger.warn(`[Auto-Reply Service] Race condition detected: duplicate lock insert for comment ID ${commentId}. Skipping duplicate post.`);
      return { 
        success: true, 
        alreadyReplied: true 
      };
    }
    logger.error(`[Auto-Reply Service] Failed to create reply lock:`, dbErr);
    return { success: false, reason: `Database locking failed: ${dbErr.message}` };
  }

  // 3. Resolve DeepSeek API Key and OpenAI client
  let apiKey = userKey;
  if (!apiKey) {
    const rawKey = process.env.DEEPSEEK_API_KEY || '';
    apiKey = rawKey.trim().replace(/^["']|["']$/g, '');
  }

  if (!apiKey) {
    logger.error('[Auto-Reply Service] DeepSeek API Key is missing. Skipping auto-reply.');
    await AutoReplyLog.deleteOne({ commentId });
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
    await AutoReplyLog.deleteOne({ commentId });
    return { success: false, reason: `Client initialization failed: ${err.message}` };
  }

  // 4. Generate Reply using DeepSeek with multi-language detection & script safety
  let detectedLanguage = 'English';
  let replyText = '';

  try {
    const prompt = `You are replying to a YouTube comment on behalf of the channel owner.
Comment: "${commentText}"

First, analyze and detect the language of the comment (e.g., Tamil, English, Hindi, Tanglish, etc.).
Then, generate a natural, relevant, warm, and friendly reply in the exact SAME language and script as the comment (e.g. if script is Tamil, reply in Tamil script; if script is Latin/English for Tanglish, reply in Tanglish; if Hindi, reply in Hindi/Hinglish as appropriate). Keep the reply short (1-2 sentences), warm, and relevant to what the commenter said. Do not use generic or templated replies.
If you cannot determine the language, or if language detection fails, default to generating the reply in English.

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

    let parsed;
    try {
      parsed = JSON.parse(rawContent.replace(/```json|```/g, '').trim());
    } catch (parseErr) {
      logger.error(`[Auto-Reply Service] First-pass JSON parsing failed: ${parseErr.message}`);
    }

    if (parsed) {
      detectedLanguage = parsed.detectedLanguage || 'English';
      replyText = parsed.reply || '';
    }

    // English fallback if reply generation or language detection failed
    if (!replyText || detectedLanguage.toLowerCase() === 'unknown') {
      logger.warn(`[Auto-Reply Service] Language detection failed or returned unknown. Defaulting to English fallback.`);
      detectedLanguage = 'English';

      const fallbackPrompt = `You are replying to a YouTube comment on behalf of the channel owner.
Comment: "${commentText}"

Generate a short, warm, natural, and friendly reply in English. Keep it to 1-2 sentences.
Respond with ONLY a JSON object:
{
  "reply": "generated reply text here"
}`;

      const fallbackResponse = await client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: fallbackPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        timeout: 25000
      });

      const fbContent = fallbackResponse.choices[0].message.content.trim();
      const fbParsed = JSON.parse(fbContent.replace(/```json|```/g, '').trim());
      replyText = fbParsed.reply || 'Thank you for your comment!';
    }
  } catch (err) {
    logger.error(`[Auto-Reply Service] DeepSeek API call failed for comment ${commentId}:`, err);
    await AutoReplyLog.deleteOne({ commentId });
    return { success: false, reason: `DeepSeek generation failed: ${err.message}` };
  }

  if (!replyText) {
    logger.warn(`[Auto-Reply Service] Empty reply text generated for comment ${commentId}. Skipping.`);
    await AutoReplyLog.deleteOne({ commentId });
    return { success: false, reason: 'Empty reply text generated' };
  }

  // 5. Post reply using YouTube API
  let activeYoutube = youtube;
  if (!activeYoutube) {
    try {
      const auth = getOAuth2Client();
      activeYoutube = google.youtube({ version: 'v3', auth });
    } catch (err) {
      logger.error(`[Auto-Reply Service] Failed to get YouTube client for comment ${commentId}:`, err);
      await AutoReplyLog.deleteOne({ commentId });
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

    // Update log status to 'success'
    try {
      await AutoReplyLog.updateOne(
        { commentId },
        {
          $set: {
            status: 'success',
            detectedLanguage,
            replyText,
            timestamp: new Date()
          }
        }
      );
      logger.info(`[Auto-Reply Service] Audit log marked as success for comment ${commentId}`);
    } catch (dbErr) {
      logger.error(`[Auto-Reply Service] Failed to update audit log:`, dbErr);
    }

    return { success: true, replyText, detectedLanguage };
  } else {
    logger.error(`[Auto-Reply Service] Failed to post auto-reply: ${errorReason}`);
    
    // Clean up lock since posting failed, allowing retries
    try {
      await AutoReplyLog.deleteOne({ commentId });
    } catch (delErr) {
      logger.error(`[Auto-Reply Service] Failed to clean up reply lock:`, delErr);
    }

    return { success: false, reason: errorReason, replyText };
  }
};
