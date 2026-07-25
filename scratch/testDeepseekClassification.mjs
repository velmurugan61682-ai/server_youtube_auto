import dotenv from 'dotenv';
import { classifyComment } from '../services/aiService.mjs';

dotenv.config();

async function run() {
  console.log('Testing DeepSeek Classification for: "Super video bro"');
  try {
    const result = await classifyComment('Super video bro');
    console.log('\n--- RESULT ---');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Classification error:', err);
  }
  process.exit(0);
}

run();
