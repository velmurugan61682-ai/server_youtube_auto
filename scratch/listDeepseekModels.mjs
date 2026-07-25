import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const key = process.env.DEEPSEEK_API_KEY;
  console.log('Testing with key:', key.substring(0, 10) + '...');
  
  const client = new OpenAI({
    apiKey: key,
    baseURL: 'https://api.deepseek.com'
  });
  
  try {
    const list = await client.models.list();
    console.log('Models list:');
    console.log(JSON.stringify(list.data, null, 2));
  } catch (err) {
    console.error('Error listing models:', err.message || err);
  }
  process.exit(0);
}

run();
