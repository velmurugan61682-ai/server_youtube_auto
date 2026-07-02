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
    const isNetworkOr5xx = !status || (status >= 500 && status <= 599);

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

Write a short, warm, natural reply (1-2 sentences max) to the comment below.
- Sound human, not corporate or robotic.
- Do not repeat the commenter's words back verbatim.
- Do not use hashtags, emojis excessively (max 1 emoji, optional), or generic phrases like "Thanks for watching!" on every reply — vary the tone.
- If the comment is a question, answer it briefly and helpfully if the video context allows; otherwise acknowledge it genuinely and invite them to ask more.
- Never mention that you are an AI.

Respond with ONLY the reply text, nothing else — no quotes, no labels.`;

  try {
    const rawReply = await callDeepSeek(systemPrompt, commentText, 0.7);
    
    // Trim and strip surrounding quotes
    let reply = rawReply.trim();
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

    return reply;
  } catch (error) {
    logger.error(`[DeepSeek Service] Error generating reply: ${error.message}`);
    throw error;
  }
};
