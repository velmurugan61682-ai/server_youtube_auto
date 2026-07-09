import OpenAI from 'openai';
import dotenv from 'dotenv';
import logger from '../utils/logger.mjs';

dotenv.config();

let openai = null;
let openAIAvailable = true;

const getOpenAI = () => {
  if (openai) return openai;
  if (!openAIAvailable) return null;

  const rawKey = process.env.DEEPSEEK_API_KEY || '';
  const key = rawKey.trim().replace(/^["']|["']$/g, '');

  if (!key || key === 'your_deepseek_api_key_here' || key.length < 20) {
    logger.error('CRITICAL: DeepSeek API key is missing or invalid in .env file!');
    logger.error('AI Classification will be disabled. System will fallback to keyword matching.');
    openAIAvailable = false;
    return null;
  }

  const maskedKey = `${key.substring(0, 7)}...${key.substring(key.length - 4)}`;
  logger.info(`DeepSeek Client initialized safely. Masked key: ${maskedKey}`);

  openai = new OpenAI({
    apiKey: key,
    baseURL: 'https://api.deepseek.com'
  });

  return openai;
};

const POSITIVE_KEYWORDS = [
  'great', 'good', 'nice', 'awesome', 'excellent', 'super', 'mass', 'thalaiva',
  'vera level', 'superb', 'keep it up', 'thanks', 'thank you', 'love', 'wow',
  'amazing', 'nandri', 'arumai', 'gethu', 'vazhthukal', 'massu', 'fire', 'lit',
  'best', 'proud', 'heart', 'king', 'legend', 'congrats', 'brilliant',
  'nanba', 'nanbi', 'thala', 'thalapathy', 'vjs', 'sk', 'super star',
  'alaithu', 'nalla', 'nalladhu', 'dhool', 'kalakureenga', 'semma',
  'massiva', 'waiting', 'luv', 'marana mass', 'attagasam', 'gud',
  'superr', 'op', 'overpowered', 'leader', 'master', 'beast', 'vaathi',
  'makkal selvan', 'ajith', 'vijay', 'surya', 'u1', 'anirudh', 'arr',
  'bgm', 'massss', 'lovely', 'beautiful', 'wonderful', 'congratulations',
  'bravo', 'perfect', '10/10'
];

const TOXIC_KEYWORDS = [
  'bad', 'useless', 'trash', 'shut up', 'idiot', 'stupid', 'fuck', 'shit',
  'garbage', 'waste', 'fool', 'worst', 'poda', 'moodu', 'wasteu',
  'kevalam', 'mokka', 'irritating', 'hate', 'die', 'fake', 'mental',
  'lossu', 'pavalam', 'loosu', 'dummy', 'kena', 'komali', 'karumam',
  'cheii', 'worst video', 'dislike', 'unsubscribed', 'unsub', 'scam',
  'fraud', 'copy', 'dei', 'da', 'punda', 'omala', 'mayiru', 'gotha',
  'go*tha', 'otha', 'thevidiya', 'baadu', 'sunni', 'poolu', 'koothi',
  'ommala', 'sunniya', 'mande', 'vetti', 'fucker', 'asshole', 'bitch',
  'scammer', 'clickbait'
];

export const classifyComment = async (text, userKey = null) => {
  let client;
  if (userKey) {
    try {
      client = new OpenAI({
        apiKey: userKey,
        baseURL: 'https://api.deepseek.com'
      });
    } catch (e) {
      logger.error('Failed to initialize OpenAI client with custom user key:', e);
      client = getOpenAI();
    }
  } else {
    client = getOpenAI();
  }

  const lowerText = text.toLowerCase().trim();

  let keywordDetected = false;
  let detectedSentiment = null;
  let detectedWords = [];

  const escapeRegExp = (string) =>
    string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const positiveMatches = POSITIVE_KEYWORDS.filter(word => {
    const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
    return regex.test(lowerText);
  });

  const toxicMatches = TOXIC_KEYWORDS.filter(word => {
    const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
    return regex.test(lowerText);
  });

  if (positiveMatches.length > 0 && toxicMatches.length === 0) {
    detectedSentiment = 'positive';
    keywordDetected = true;
    detectedWords = positiveMatches.map(w => ({
      word: w,
      category: 'appreciation'
    }));
  } else if (toxicMatches.length > 0) {
    detectedSentiment = 'toxic';
    keywordDetected = true;
    detectedWords = toxicMatches.map(w => ({
      word: w,
      category: 'insult'
    }));
  }

  // Removing early bypass to ensure every comment is analyzed with DeepSeek

  logger.info(`[DEEPSEEK] Preparing AI analysis for comment: "${text}"`);

  if (!client) {
    if (openAIAvailable) {
      logger.warn('[DEEPSEEK] API Key missing, using keyword fallback.');
    }

    return {
      classification: detectedSentiment === 'toxic' ? 'Toxic' : (detectedSentiment === 'positive' ? 'Positive' : 'Neutral'),
      sentiment: detectedSentiment || 'moderate',
      toxicityScore: detectedSentiment === 'toxic' ? 0.8 : 0,
      confidence: keywordDetected ? 0.9 : 0.5,
      language: 'unknown',
      detectedWords,
      lead: { isLead: false, email: null, phone: null, intent: null, notes: null, productInterest: null, language: null },
      suggestedReply: null
    };
  }

  try {
    logger.info(`[DEEPSEEK] Sending chat completion request to model 'deepseek-chat'`);
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `You are an expert YouTube AI Moderator, Lead Extractor, and Engagement Agent.
You must carefully moderate comments in English, Tamil, and Tanglish (Tamil words written in Latin/English script).
Identify and mark "toxic", "profanity", "abuse", "badWords", or "hate" as true if the comment contains any toxic remarks, swearing, or abusive/vulgar slang in Tamil/Tanglish (e.g., words like "poda", "moodu", "kena", "koothi", "otha", "punda", "loose", "vetti", "wasteu", "kevalam", "mokka", "dei", "da", "baadu", "sunni", "gotha", "thevidiya") or English equivalents.
Analyze the user's comment and output a JSON object containing the following keys and values. Do not output any markdown formatting (like \`\`\`json) or extra text. Output ONLY the JSON object.

JSON Schema:
{
  "positive": boolean, // True if the comment is appreciative, encouraging, or positive
  "neutral": boolean,  // True if the comment is neutral, descriptive, or informational
  
  // Toxicity & Moderation checks (detecting all requested categories):
  "toxic": boolean,    // True if the comment contains toxic language, rudeness, aggression
  "spam": boolean,     // True if the comment contains spam, nonsensical text, or repetitive content
  "abuse": boolean,    // True if the comment contains abuse, insults, name-calling, or bullying
  "threat": boolean,   // True if the comment contains threats of violence or harm
  "scam": boolean,     // True if the comment is a scam, phishing, or fraud
  "hate": boolean,     // True if the comment contains hate speech, slurs, or discrimination
  "profanity": boolean,// True if the comment contains profanity or swearing
  "badWords": boolean, // True if the comment contains bad words
  "maliciousReview": boolean, // True if the comment is a malicious review targeting the product or channel
  "selfPromotion": boolean, // True if the comment is self-promotion
  "advertisement": boolean, // True if the comment is an advertisement or sales pitch
  "harassment": boolean, // True if the comment contains harassment or stalking behavior
  "hateSpeech": boolean, // True if the comment contains hate speech
  "fakeReview": boolean, // True if the comment contains a fake review or false testimonial
  "offensiveReview": boolean, // True if the comment contains an offensive review/complaint
  
  // Lead & Intent Extraction:
  "phoneNumber": string or null, // Extracted phone/mobile number (if any)
  "whatsappNumber": string or null, // Extracted WhatsApp number (if any)
  "email": string or null, // Extracted email address (if any)
  "buyingIntent": boolean, // True if the user expresses interest in buying, pricing, or ordering a product/service
  "sellingIntent": boolean, // True if the user is trying to sell something
  "question": boolean, // True if the comment contains a genuine question or inquiry
  "customer": boolean, // True if the user is an existing customer or showing customer behavior
  "leadScore": number, // An integer from 0 to 100 representing how high-quality this lead is
  "confidenceScore": number, // A float from 0.0 to 1.0 representing your confidence in this analysis
  "emotion": string, // The primary emotion of the comment (e.g. "happy", "angry", "curious", "frustrated")
  "urgency": string, // "low", "medium", or "high" based on how urgently the user needs a response
  "detectedLanguage": string, // The language of the comment (e.g. "English", "Tamil", "Tanglish")
  
  // AI Reply Generation Rules:
  "suggestedReply": string or null // A short, natural, human-like reply. Generate a friendly, natural suggested reply ONLY if the comment contains a genuine question or expresses buying-intent (i.e. 'question' or 'buyingIntent' is true) and is completely safe/normal. Set to null for all other comments, or if the comment contains any toxic, spam, abusive, bad words, profanity, hate speech, harassment, scam, fake/offensive reviews, self-promotion, or advertisement.
}

Examples of suggestedReply style:
- Friendly, conversational, and direct.
- Never sound like a robot/bot. Avoid generic greetings.
- If the user asks a question, answer it directly or politely say we'll follow up.
- If in Tamil/Tanglish, reply in the matching style (e.g., if in Tanglish, reply in friendly Tanglish/English).`
        },
        {
          role: 'user',
          content: text
        }
      ],
      response_format: { type: 'json_object' }
    });

    const rawContent = response.choices[0].message.content.trim();
    logger.info(`[DEEPSEEK] Raw API Response: ${rawContent}`);
    
    let jsonString = rawContent;
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }
    const result = JSON.parse(jsonString);
    logger.info(`[DEEPSEEK] Parsed JSON Response: ${JSON.stringify(result, null, 2)}`);

    // Map classification to the most specific category detected
    let classification = 'Neutral';
    if (result.toxic) classification = 'Toxic';
    else if (result.profanity) classification = 'Profanity';
    else if (result.badWords) classification = 'Bad Words';
    else if (result.hate || result.hateSpeech) classification = 'Hate Speech';
    else if (result.harassment) classification = 'Harassment';
    else if (result.abuse) classification = 'Abuse';
    else if (result.spam) classification = 'Spam';
    else if (result.scam) classification = 'Scam';
    else if (result.fakeReview) classification = 'Fake Review';
    else if (result.offensiveReview || result.maliciousReview) classification = 'Offensive Review';
    else if (result.selfPromotion) classification = 'Self Promotion';
    else if (result.advertisement) classification = 'Advertisement';
    else if (result.threat) classification = 'Threat';
    else if (result.question) classification = 'Question';
    else if (result.buyingIntent || result.customer) classification = 'Lead';
    else if (result.positive) classification = 'Positive';

    // Map sentiment
    let sentiment = 'neutral';
    const isToxicOrBad = result.toxic || result.abuse || result.threat || result.hate || result.profanity || 
      result.badWords || result.harassment || result.hateSpeech || result.spam || result.scam || 
      result.fakeReview || result.offensiveReview || result.maliciousReview || result.selfPromotion || result.advertisement;

    if (isToxicOrBad) {
      sentiment = 'toxic';
    } else if (result.positive) {
      sentiment = 'positive';
    } else if (result.neutral) {
      sentiment = 'neutral';
    } else {
      sentiment = 'moderate';
    }

    // Map lead details
    const isLead = !!(result.buyingIntent || result.customer || result.whatsappNumber || result.phoneNumber || result.email);
    const lead = {
      isLead,
      email: result.email || null,
      phone: result.whatsappNumber || result.phoneNumber || null,
      intent: result.buyingIntent ? 'Purchase Intent' : (result.customer ? 'Interested' : null),
      productInterest: result.buyingIntent ? 'Product Interest' : null,
      language: result.detectedLanguage || 'English',
      notes: `Emotion: ${result.emotion || 'unknown'} | Urgency: ${result.urgency || 'low'} | Lead Score: ${result.leadScore || 0}`
    };

    let finalWords = result.detectedWords || [];

    if (
      lowerText.length < 20 &&
      positiveMatches.length > 0 &&
      (sentiment === 'moderate' || sentiment === 'neutral')
    ) {
      sentiment = 'positive';
      if (classification === 'Neutral') {
        classification = 'Positive';
      }

      const existingWords = new Set(finalWords.map(w => w.word.toLowerCase()));
      positiveMatches.forEach(w => {
        if (!existingWords.has(w)) {
          finalWords.push({
            word: w,
            category: 'appreciation'
          });
        }
      });
    }

    logger.info(`[DEEPSEEK] Final classification: ${classification}, Sentiment: ${sentiment}, SuggestedReply: ${result.suggestedReply}`);

    return {
      classification,
      sentiment,
      toxicityScore: result.toxicityScore || (sentiment === 'toxic' ? 0.8 : (sentiment === 'moderate' ? 0.4 : 0)),
      confidence: result.confidenceScore || 0.85,
      language: result.detectedLanguage || 'English',
      detectedWords: finalWords,
      lead,
      suggestedReply: result.suggestedReply || null,
      rawAnalysis: result
    };
  } catch (error) {
    if (error.status === 401) {
      logger.error('CRITICAL: DeepSeek API returned 401 Unauthorized.');
      logger.error('Check your DEEPSEEK_API_KEY in .env');
      openAIAvailable = false;
    } else {
      logger.error('AI Classification error:', error.message || error);
    }

    return {
      classification: detectedSentiment === 'toxic' ? 'Toxic' : (detectedSentiment === 'positive' ? 'Positive' : 'Neutral'),
      sentiment: detectedSentiment || 'moderate',
      toxicityScore: detectedSentiment === 'toxic' ? 0.8 : 0,
      confidence: keywordDetected ? 0.9 : 0.5,
      language: 'unknown',
      detectedWords,
      lead: { isLead: false, email: null, phone: null, intent: null, notes: null, productInterest: null, language: null },
      suggestedReply: null
    };
  }
};

export const analyzeVideo = async (title, description, tags = [], categoryId = '', userKey = null) => {
  let client;
  if (userKey) {
    try {
      client = new OpenAI({
        apiKey: userKey,
        baseURL: 'https://api.deepseek.com'
      });
    } catch (e) {
      logger.error('Failed to initialize OpenAI client with custom user key for video:', e);
      client = getOpenAI();
    }
  } else {
    client = getOpenAI();
  }

  if (!client) {
    logger.warn('DeepSeek API Client missing, using keyword fallback for Video.');
    return {
      tags: tags,
      category: categoryId,
      language: 'unknown',
      keywords: [],
      sentiment: 'neutral',
      topic: 'unknown',
      seoQuality: 'Low',
      summary: 'API Key missing, analysis skipped.'
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `You are an expert YouTube SEO and Video Analysis AI.
Analyze the video metadata (title, description, tags, categoryId) and return a JSON object with:
1. "tags": array of best tags for this video.
2. "category": string representing the category.
3. "language": string representing the primary language.
4. "keywords": array of primary SEO keywords.
5. "sentiment": string (e.g. "positive", "neutral", "inspirational").
6. "topic": string (main topic of the video).
7. "seoQuality": string ("High", "Medium", "Low" based on description completeness and keywords).
8. "summary": string (brief AI summary of the video content/purpose).

Return ONLY valid JSON.`
        },
        {
          role: 'user',
          content: JSON.stringify({ title, description, tags, categoryId })
        }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    logger.error('Video analysis error:', error);
    return {
      tags: tags,
      category: categoryId,
      language: 'unknown',
      keywords: [],
      sentiment: 'neutral',
      topic: 'unknown',
      seoQuality: 'Low',
      summary: `Analysis failed: ${error.message}`
    };
  }
};