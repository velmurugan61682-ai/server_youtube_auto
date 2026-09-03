import dotenv from 'dotenv';
import path from 'path';
import OpenAI from 'openai';

dotenv.config({ path: path.join(process.cwd(), 'server_youtube_auto', '.env') });
if (!process.env.DEEPSEEK_API_KEY) {
  dotenv.config({ path: '.env' });
}

import { classifyComment, analyzeVideo } from '../services/aiService.mjs';

async function main() {
  console.log('=== DEEPSEEK AI LIVE FUNCTIONALITY TEST ===\n');

  const apiKey = process.env.DEEPSEEK_API_KEY || '';
  console.log(`DeepSeek API Key present: ${apiKey ? `YES (sk-...${apiKey.slice(-4)})` : 'NO'}`);

  const client = new OpenAI({
    apiKey: apiKey.trim(),
    baseURL: 'https://api.deepseek.com'
  });

  // 1. Test direct API call to DeepSeek models list
  console.log('\n1. Testing DeepSeek Models List Endpoint...');
  try {
    const list = await client.models.list();
    console.log(`✓ [MODELS LIST SUCCESS] Available models: ${list.data.map(m => m.id).join(', ')}`);
  } catch (err) {
    console.error(`❌ DeepSeek Models List Error: ${err.message}`);
  }

  // 2. Test direct Chat Completion call to DeepSeek
  console.log('\n2. Testing DeepSeek Chat Completion (deepseek-chat)...');
  try {
    const startTime = Date.now();
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are a helpful YouTube comment assistant.' },
        { role: 'user', content: 'Say "DeepSeek AI is working perfectly!" in Tamil and English.' }
      ],
      max_tokens: 100
    });
    const duration = Date.now() - startTime;
    console.log(`✓ [COMPLETION SUCCESS] (${duration}ms) Response:`);
    console.log(`  "${completion.choices[0]?.message?.content?.trim()}"`);
    console.log(`  Tokens used: ${completion.usage?.total_tokens}`);
  } catch (err) {
    console.error(`❌ DeepSeek Chat Completion Error: ${err.message}`);
  }

  // 3. Test classifyComment function from aiService.mjs
  console.log('\n3. Testing classifyComment() function...');
  const testComments = [
    "Awesome video bro, vera level content! 🔥",
    "Poda loosu waste video trash",
    "Bro what is the price and link for this product?"
  ];

  for (const text of testComments) {
    try {
      const result = await classifyComment(text);
      console.log(`\n  Input: "${text}"`);
      console.log(`  Result: Category: [${result.category}], Sentiment: [${result.sentiment}], IsToxic: [${result.isToxic}], Confidence: [${result.confidence}%]`);
    } catch (err) {
      console.error(`  Error classifying "${text}": ${err.message}`);
    }
  }

  // 4. Test analyzeVideo function from aiService.mjs
  console.log('\n4. Testing analyzeVideo() function...');
  try {
    const videoAnalysis = await analyzeVideo(
      "YouTube Channel Growth Guide",
      "Learn how to grow your YouTube channel fast with AI automation tools.",
      ["youtube", "ai", "growth"],
      "28"
    );
    console.log(`✓ [VIDEO ANALYSIS SUCCESS] Output:`);
    console.log(`  Category: ${videoAnalysis.category}`);
    console.log(`  SEO Quality: ${videoAnalysis.seoQuality}`);
    console.log(`  Summary: "${videoAnalysis.summary}"`);
  } catch (err) {
    console.error(`❌ Video Analysis Error: ${err.message}`);
  }

  console.log('\n=== DEEPSEEK TEST COMPLETED ===');
}

main().catch(console.error);
