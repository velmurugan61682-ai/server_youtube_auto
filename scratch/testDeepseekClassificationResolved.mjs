import dotenv from 'dotenv';
import OpenAI from 'openai';
import { normalizeLanguage } from '../services/aiService.mjs';

dotenv.config();

async function run() {
  const key = process.env.DEEPSEEK_API_KEY;
  const client = new OpenAI({
    apiKey: key,
    baseURL: 'https://api.deepseek.com'
  });

  let resolvedModel = 'deepseek-chat';
  try {
    const list = await client.models.list();
    const modelIds = list.data.map(m => m.id);
    if (!modelIds.includes('deepseek-chat')) {
      if (modelIds.includes('deepseek-v4-flash')) {
        resolvedModel = 'deepseek-v4-flash';
      } else if (modelIds.includes('deepseek-v4-pro')) {
        resolvedModel = 'deepseek-v4-pro';
      } else if (modelIds.length > 0) {
        resolvedModel = modelIds[0];
      }
    }
    console.log(`Resolved model: ${resolvedModel}`);
  } catch (err) {
    console.log('Failed to list models, default to deepseek-chat');
  }

  try {
    console.log('Sending chat completion request with model:', resolvedModel);
    const response = await client.chat.completions.create({
      model: resolvedModel,
      messages: [
        {
          role: 'system',
          content: `You are an expert multi-lingual ChannelBot YouTube comment safety and lead-intent auditor.
Analyze the given YouTube comment across ALL languages (Tamil script, Tanglish/Latin Tamil, English, Hindi, Hinglish, Spanish, Malayalam, Telugu, etc.) with human-level intelligence.

Output a JSON object containing EXACTLY the following keys:
{
  "category": string, // one of: "toxic", "spam", "hate speech", "abuse", "threat", "scam", "adult content", "positive", "question", "neutral feedback"
  "confidence": number, // confidence score between 0.0 and 1.0
  "isToxic": boolean, // true only if category is "toxic", "spam", "hate speech", "abuse", "threat", "scam", or "adult content". Otherwise false.
  "detectedLanguage": string, // detected language
  "suggestedReply": string or null // null if isToxic is true. If false, a friendly 1-2 sentence reply in the EXACT SAME language and script as the comment.
}`
        },
        {
          role: 'user',
          content: 'Super video bro'
        }
      ],
      response_format: { type: 'json_object' }
    });

    const rawContent = response.choices[0].message.content.trim();
    console.log('Raw Content:', rawContent);
  } catch (err) {
    console.error('Error during completion:', err);
  }
  process.exit(0);
}

run();
