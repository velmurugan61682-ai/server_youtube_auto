import axios from 'axios';
import logger from '../utils/logger.mjs';

/**
 * Shared internal helper to call DeepSeek API with retry logic on transient errors.
 * 
 * @param {string} systemPrompt 
 * @param {string} userMessage 
 * @param {number} temperature 
 * @param {number} retryCount 
 * @returns {Promise<string>}
 */
const callDeepSeek = async (systemPrompt, userMessage, temperature, retryCount = 1) => {
  const apiKey = (process.env.DEEPSEEK_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not defined or is empty in the environment.');
  }

  try {
    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature,
        response_format: systemPrompt.includes('JSON') ? { type: 'json_object' } : undefined
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 30000 // 30-second timeout
      }
    );

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format received from DeepSeek API.');
    }

    return response.data.choices[0].message.content;
  } catch (error) {
    const status = error.response?.status;
    const is402 = status === 402 || error.message?.includes('402') || error.message?.toLowerCase().includes('insufficient balance');
    const isNetworkOr5xx = !status || (status >= 500 && status <= 599);

    if (is402) {
      logger.error(`[DeepSeek Service] Insufficient balance error detected (402). Disabling AI status.`);
      global.isAiAvailable = false;
      throw error;
    }

    if (isNetworkOr5xx && retryCount > 0) {
      logger.warn(`[DeepSeek Service] Call failed (Status: ${status || 'Network Error'}). Retrying once in 1s...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return callDeepSeek(systemPrompt, userMessage, temperature, retryCount - 1);
    }

    logger.error(`[DeepSeek Service] API call failed: ${error.message} (Status: ${status || 'N/A'})`);
    throw error;
  }
};

/**
 * Classifies a comment as toxic, spam, review, or normal.
 * 
 * @param {string} text 
 * @returns {Promise<object>}
 */
export const classifyComment = async (text) => {
  const lowerText = text.toLowerCase().trim();
  const hasFire = text.includes('🔥') || lowerText.includes('fire');
  const hasDetail = lowerText.includes('detail');

  if (hasFire || hasDetail) {
    logger.info(`[DeepSeek Service] Bypassing classification for fire/detail comment: "${text}"`);
    return {
      category: hasFire ? 'normal' : 'review',
      reason: hasFire ? 'fire comment override' : 'detail comment override',
      reply_needed: true,
      severity: 'low'
    };
  }

  const systemPrompt = `You are a strict comment moderation classifier for a YouTube channel.
Classify the given comment into exactly one category:

- "toxic": hate speech, harassment, threats, slurs, sexual harassment, targeted insults
- "spam": promotional links, scam offers, bot-like repeated text, unrelated ads
- "review": a genuine question, feedback, or opinion about the video/product/content
- "normal": casual, friendly, or neutral comment that doesn't need moderation

Respond with ONLY valid JSON, no extra text, no markdown fences, in this exact shape:
{
  "category": "toxic" | "spam" | "review" | "normal",
  "reason": "one short sentence explaining why",
  "reply_needed": true or false,
  "severity": "low" | "medium" | "high"
}

Rules:
- severity only applies to "toxic" comments (use "low" for others)
- reply_needed is true for "normal" and "review", false for "toxic" and "spam"
- Never invent content not present in the comment
- If uncertain between toxic and normal, prefer "normal" with reply_needed true (avoid over-flagging)`;

  try {
    const rawResponse = await callDeepSeek(systemPrompt, text, 0.2);
    
    // Parse the response as JSON
    try {
      return JSON.parse(rawResponse.trim());
    } catch (initialError) {
      logger.warn('[DeepSeek Service] Initial JSON parse failed. Retrying parsing after extracting outermost brackets...');
      
      // Attempt to strip anything outside the outermost { }
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (secondError) {
          logger.error(`[DeepSeek Service] Secondary JSON parse failed: ${secondError.message}`);
        }
      }

      logger.error(`[DeepSeek Service] Failed to parse classification raw text: "${rawResponse}"`);
      return {
        category: 'normal',
        reason: 'classification failed, defaulting safe',
        reply_needed: false,
        severity: 'low'
      };
    }
  } catch (error) {
    logger.error(`[DeepSeek Service] Error during comment classification: ${error.message}`);
    throw error;
  }
};

/**
 * Generates a warm, natural auto-reply to a comment using video context.
 * 
 * @param {string} commentText 
 * @param {object} videoContext 
 * @returns {Promise<string>}
 */
export const generateReply = async (commentText, videoContext = {}) => {
  const title = videoContext?.title || 'this video';
  const description = videoContext?.description || '';

  const systemPrompt = `You are replying as the official YouTube channel owner to a comment on your own video.
Video title: ${title}
Video description (short): ${description}

First, detect the language/script the comment is written in (Tamil, English, Tanglish, Hindi, or other).
Then write a short, warm, natural reply (1-2 sentences max) in the SAME language and SAME script as the comment.
- If it's Tanglish (Tamil words in English letters), reply in Tanglish too, not formal Tamil script.
- Sound human, not robotic or corporate.
- Do not use hashtags. Max 1 emoji, optional.
- Never mention you are an AI.

Respond with ONLY a JSON object (no markdown, no other text) in this format:
{
  "detectedLanguage": "Tamil | English | Tanglish | Hindi | other",
  "reply": "your reply text here"
}`;

  try {
    const rawReply = await callDeepSeek(systemPrompt, commentText, 0.7);
    
    let reply = '';
    let detectedLanguage = 'unknown';

    const cleanedRaw = rawReply.trim();
    let parsedObj = null;

    try {
      parsedObj = JSON.parse(cleanedRaw);
    } catch (e) {
      // Try to extract JSON structure from potential markdown or surrounding text
      const jsonMatch = cleanedRaw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedObj = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          // ignore parsing error
        }
      }
    }

    if (parsedObj && typeof parsedObj === 'object') {
      reply = parsedObj.reply || '';
      detectedLanguage = parsedObj.detectedLanguage || 'unknown';
    } else {
      reply = cleanedRaw;
    }

    // Trim and strip surrounding quotes
    reply = reply.trim();
    reply = reply.replace(/^["']|["']$/g, '').trim();

    // Enforce max length safeguard (~300 characters)
    const MAX_LENGTH = 300;
    if (reply.length > MAX_LENGTH) {
      const sub = reply.substring(0, MAX_LENGTH);
      const lastSentenceEnd = Math.max(
        sub.lastIndexOf('.'),
        sub.lastIndexOf('!'),
        sub.lastIndexOf('?')
      );

      if (lastSentenceEnd > 0) {
        reply = sub.substring(0, lastSentenceEnd + 1).trim();
      } else {
        reply = sub.trim();
      }
    }

    return {
      reply,
      detectedLanguage
    };
  } catch (error) {
    logger.error(`[DeepSeek Service] Error generating reply: ${error.message}`);
    throw error;
  }
};
