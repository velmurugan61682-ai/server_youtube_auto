import OpenAI from 'openai';
import dotenv from 'dotenv';
import logger from '../utils/logger.mjs';

dotenv.config();

let openai = null;
let openAIAvailable = true;

const callWithRetry = async (client, body, maxRetries = 1) => {
  let attempt = 0;
  while (true) {
    try {
      return await client.chat.completions.create(body);
    } catch (error) {
      const status = error.status || error.response?.status;
      const is402 = status === 402 || error.message?.includes('402') || error.message?.toLowerCase().includes('insufficient balance') || (error.response && error.response.status === 402);
      const isTemporary = !status || (status >= 500 && status <= 599) || error.message?.includes('timeout') || error.code === 'ETIMEDOUT';

      if (is402) {
        logger.error(`[DEEPSEEK] Insufficient balance error detected (402). Disabling AI status.`);
        global.isAiAvailable = false;
        throw error;
      }

      if (isTemporary && attempt < maxRetries) {
        attempt++;
        logger.warn(`[DEEPSEEK] API call failed with temporary error. Retrying attempt ${attempt}/${maxRetries} in 1s...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      throw error;
    }
  }
};

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
  'useless', 'trash', 'shut up', 'idiot', 'stupid', 'fuck', 'shit',
  'garbage', 'waste', 'fool', 'worst', 'poda', 'moodu', 'wasteu',
  'kevalam', 'mokka', 'irritating', 'hate', 'die', 'mental',
  'lossu', 'pavalam', 'loosu', 'dummy', 'kena', 'komali', 'karumam',
  'cheii', 'worst video', 'scam', 'fraud', 'punda', 'omala',
  'mayiru', 'gotha', 'go*tha', 'otha', 'thevidiya', 'baadu', 'sunni',
  'poolu', 'koothi', 'ommala', 'sunniya', 'mande', 'vetti', 'fucker',
  'asshole', 'bitch', 'scammer', 'clickbait'
];

const PRODUCT_INQUIRY_KEYWORDS = [
  'app', 'app link', 'application', 'product', 'product link', 'link', 'price',
  'pricing', 'rate', 'cost', 'amount', 'fees', 'fee', 'details', 'detail',
  'course', 'demo', 'join', 'contact', 'phone', 'call', 'whatsapp', 'number',
  'mobile number', 'contact number', 'buy', 'order', 'purchase', 'available',
  'interested', 'dm', 'message', 'pls', 'please', 'bro', 'suite ready',
  'business', 'automate', 'automation', 'table', 'wood', 'wooden', 'marathula',
  'vachrukka', 'vilai', 'evlo', 'evalo', 'eppadi join', 'contact pannunga',
  'whatsapp pannunga', 'விலை', 'தொடர்பு', 'எண்', 'லிங்க்', 'ஆப்', 'விவரம்'
];

const escapeKeywordRegExp = (string) =>
  string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const isProductInquiryComment = (text = '') => {
  const lower = String(text || '').toLowerCase();
  if (!lower.trim()) return false;

  return PRODUCT_INQUIRY_KEYWORDS.some(keyword => {
    const normalizedKeyword = keyword.toLowerCase();
    if (new RegExp('[\\u0B80-\\u0BFF]').test(normalizedKeyword)) {
      return lower.includes(normalizedKeyword);
    }

    const escapedKeyword = escapeKeywordRegExp(normalizedKeyword);
    return new RegExp(`(^|[^a-z0-9])${escapedKeyword}([^a-z0-9]|$)`, 'i').test(lower);
  });
};

export const normalizeLanguage = (value, text = '') => {
  const language = String(value || '').trim();
  if (language && !['unknown', 'undefined', 'null'].includes(language.toLowerCase())) {
    return language;
  }

  if (new RegExp('[\\u0B80-\\u0BFF]').test(text)) return 'Tamil';
  if (new RegExp('[\\u0900-\\u097F]').test(text)) return 'Hindi';
  if (new RegExp('[\\u0C00-\\u0C7F]').test(text)) return 'Telugu';
  if (new RegExp('[\\u0D00-\\u0D7F]').test(text)) return 'Malayalam';
  if (new RegExp('[\\u0C80-\\u0CFF]').test(text)) return 'Kannada';

  const lower = String(text || '').toLowerCase();
  if (/\b(da|dei|poda|machi|nanba|semma|nalla|thala|mokka|loosu|omala|punda|otha|mayiru)\b/.test(lower)) {
    return 'Tanglish';
  }

  return text ? 'English' : 'Unknown';
};

export const classifyComment = async (text, userKey = null) => {
  const lowerText = text.toLowerCase().trim();
  const fallbackLanguage = normalizeLanguage(null, text);
  const productInquiryDetected = isProductInquiryComment(text);

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

    const isToxic = detectedSentiment === 'toxic';
    const isProductInquiry = productInquiryDetected && !isToxic;
    const fallbackCategoryScores = {
      toxic: isToxic ? 0.8 : 0.0,
      spam: 0.0,
      hateSpeech: 0.0,
      abuse: 0.0,
      scam: 0.0,
      sexualContent: 0.0
    };

    return {
      classification: isToxic ? 'Toxic' : (isProductInquiry ? 'Question' : (detectedSentiment === 'positive' ? 'Positive' : 'Neutral')),
      sentiment: isToxic ? 'toxic' : (detectedSentiment || 'moderate'),
      isToxic: isToxic,
      toxicityScore: isToxic ? 0.8 : 0,
      confidence: keywordDetected || isProductInquiry ? 0.9 : 0.5,
      language: fallbackLanguage,
      detectedWords,
      lead: {
        isLead: isProductInquiry,
        email: null,
        phone: null,
        intent: isProductInquiry ? 'Product inquiry' : null,
        notes: isProductInquiry ? 'Product/contact/link request detected locally' : null,
        productInterest: isProductInquiry ? 'General' : null,
        language: fallbackLanguage
      },
      suggestedReply: null,
      categoryScores: fallbackCategoryScores,
      rawAnalysis: {
        toxic: isToxic,
        productInquiry: isProductInquiry,
        buyingIntent: isProductInquiry,
        customer: isProductInquiry,
        categoryScores: fallbackCategoryScores
      }
    };
  }

  try {
    logger.info(`[DEEPSEEK] Sending chat completion request to model 'deepseek-chat'`);
    const response = await callWithRetry(client, {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `You are an expert multi-lingual ChannelMate YouTube comment safety and lead-intent auditor.
Analyze the given YouTube comment across ALL languages (Tamil script, Tanglish/Latin Tamil, English, Hindi, Hinglish, Spanish, Malayalam, Telugu, etc.) with human-level intelligence.

Detect only real safety issues: profanity, slurs, toxic insults, harassment, hate speech, threats, adult content, scams, phishing, repeated unrelated promotion, or malicious spam.

Normal customer/product inquiries are SAFE and must be categorized as "question" or "neutral feedback", never "spam" or "toxic", unless they also contain actual abuse, scam, threats, slurs, or explicit adult content. Safe inquiries include asking for app link, product link, WhatsApp/contact/mobile number, price, fees, demo, course details, product details, order/buy/purchase info, business automation, or "SUITE ready" details.

Output a JSON object containing EXACTLY the following keys:
{
  "category": string, // one of: "toxic", "spam", "hate speech", "abuse", "threat", "scam", "adult content", "positive", "question", "neutral feedback"
  "confidence": number, // confidence score between 0.0 and 1.0
  "isToxic": boolean, // true only if category is "toxic", "spam", "hate speech", "abuse", "threat", "scam", or "adult content". Otherwise false.
  "detectedLanguage": string, // detected language (e.g. "Tanglish", "Tamil", "English", "Hindi", "Hinglish", "Spanish", etc.)
  "suggestedReply": string or null // null if isToxic is true. If false, a friendly 1-2 sentence reply in the EXACT SAME language and script as the comment.
}

Moderation Rules:
- Slang/bad words in Tanglish (e.g., Tamil insults written in English letters) MUST be flagged as toxic ("toxic" or "abuse" or "hate speech").
- Abusive or offensive comments in Hindi, Hinglish, Spanish, or any regional language MUST be flagged as toxic.
- Do not treat "app link bro", "contact number pls", "price details", "WhatsApp number", or similar buyer questions as spam.
- Output ONLY the raw JSON object (no markdown formatting, no extra text).`
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
    let cat = (result.category || '').toLowerCase().trim();
    const forceSafeProductInquiry = productInquiryDetected && toxicMatches.length === 0 && !['hate speech', 'abuse', 'threat', 'scam', 'adult content'].includes(cat);
    if (forceSafeProductInquiry) {
      cat = 'question';
      result.category = 'question';
      result.isToxic = false;
      result.productInquiry = true;
      result.buyingIntent = true;
      result.customer = true;
    }
    if (cat === 'toxic') classification = 'Toxic';
    else if (cat === 'spam') classification = 'Spam';
    else if (cat === 'hate speech') classification = 'Hate Speech';
    else if (cat === 'abuse') classification = 'Abuse';
    else if (cat === 'threat') classification = 'Threat';
    else if (cat === 'scam') classification = 'Scam';
    else if (cat === 'adult content') classification = 'Sexual Content';
    else if (cat === 'positive') classification = 'Positive';
    else if (cat === 'question') classification = 'Question';
    else if (cat === 'neutral feedback') classification = 'Neutral';

    // Map sentiment
    let sentiment = 'neutral';
    if (result.isToxic) {
      sentiment = 'toxic';
    } else if (cat === 'positive') {
      sentiment = 'positive';
    } else if (cat === 'neutral feedback' || cat === 'neutral') {
      sentiment = 'neutral';
    } else {
      sentiment = 'moderate';
    }

    const detectedLanguage = normalizeLanguage(result.detectedLanguage || result.language, text);
    const confidenceScore = Number.isFinite(Number(result.confidence)) ? Number(result.confidence) : 0.85;

    // Map lead details
    const isLead = cat === 'question' || productInquiryDetected;
    const lead = {
      isLead,
      email: null,
      phone: null,
      intent: productInquiryDetected ? 'Product inquiry' : (isLead ? 'Inquiry' : null),
      productInterest: productInquiryDetected ? 'General' : null,
      language: detectedLanguage,
      notes: `${productInquiryDetected ? 'Product/contact/link request detected. ' : ''}Category: ${result.category} | Confidence: ${confidenceScore}`
    };

    let finalWords = [];

    // Category-level breakdown scores (0.0 to 1.0)
    const categoryScores = {
      toxic: cat === 'toxic' ? confidenceScore : 0.0,
      spam: cat === 'spam' ? confidenceScore : 0.0,
      hateSpeech: cat === 'hate speech' ? confidenceScore : 0.0,
      abuse: cat === 'abuse' ? confidenceScore : 0.0,
      scam: cat === 'scam' ? confidenceScore : 0.0,
      sexualContent: cat === 'adult content' ? confidenceScore : 0.0
    };

    return {
      classification,
      sentiment,
      isToxic: result.isToxic || false,
      toxicityScore: result.isToxic ? confidenceScore : 0.0,
      confidence: confidenceScore,
      language: detectedLanguage,
      detectedWords: finalWords,
      lead,
      suggestedReply: result.suggestedReply || null,
      categoryScores,
      rawAnalysis: {
        ...result,
        productInquiry: productInquiryDetected,
        buyingIntent: productInquiryDetected || result.buyingIntent || false,
        customer: productInquiryDetected || result.customer || false,
        categoryScores
      }
    };
  } catch (error) {
    const is402 = error.status === 402 || error.message?.includes('402') || error.message?.toLowerCase().includes('insufficient balance') || (error.response && error.response.status === 402);
    if (is402) {
      logger.error('CRITICAL: DeepSeek API returned 402 Insufficient Balance. Marking AI as Unavailable.');
      global.isAiAvailable = false;
    } else if (error.status === 401) {
      logger.error('CRITICAL: DeepSeek API returned 401 Unauthorized.');
      logger.error('Check your DEEPSEEK_API_KEY in .env');
      openAIAvailable = false;
    } else {
      logger.error('AI Classification error:', error.message || error);
    }

    const isToxic = detectedSentiment === 'toxic';
    const isProductInquiry = productInquiryDetected && !isToxic;
    const fallbackCategoryScores = {
      toxic: isToxic ? 0.8 : 0.0,
      spam: 0.0,
      hateSpeech: 0.0,
      abuse: 0.0,
      scam: 0.0,
      sexualContent: 0.0
    };

    return {
      classification: isToxic ? 'Toxic' : (isProductInquiry ? 'Question' : (detectedSentiment === 'positive' ? 'Positive' : 'Neutral')),
      sentiment: isToxic ? 'toxic' : (detectedSentiment || 'moderate'),
      isToxic: isToxic,
      toxicityScore: isToxic ? 0.8 : 0,
      confidence: keywordDetected || isProductInquiry ? 0.9 : 0.5,
      language: fallbackLanguage,
      detectedWords,
      lead: {
        isLead: isProductInquiry,
        email: null,
        phone: null,
        intent: isProductInquiry ? 'Product inquiry' : null,
        notes: isProductInquiry ? 'Product/contact/link request detected locally' : null,
        productInterest: isProductInquiry ? 'General' : null,
        language: fallbackLanguage
      },
      suggestedReply: null,
      categoryScores: fallbackCategoryScores,
      rawAnalysis: {
        toxic: isToxic,
        productInquiry: isProductInquiry,
        buyingIntent: isProductInquiry,
        customer: isProductInquiry,
        categoryScores: fallbackCategoryScores
      }
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
    const response = await callWithRetry(client, {
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
    const is402 = error.status === 402 || error.message?.includes('402') || error.message?.toLowerCase().includes('insufficient balance') || (error.response && error.response.status === 402);
    if (is402) {
      logger.error('CRITICAL: DeepSeek API returned 402 Insufficient Balance for Video Analysis. Marking AI as Unavailable.');
      global.isAiAvailable = false;
    }
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
