import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

console.log('Testing Razorpay with Key ID:', key_id);

if (!key_id || !key_secret) {
  console.error('Missing Razorpay credentials');
  process.exit(1);
}

const razorpay = new Razorpay({ key_id, key_secret });

async function run() {
  try {
    console.log('Fetching plans...');
    const plans = await razorpay.plans.all({ count: 5 });
    console.log('Plans found:', plans.items?.length);
    plans.items?.forEach(p => {
      console.log(` - Plan ID: ${p.id}, Name: ${p.item?.name}, Amount: ${p.item?.amount}`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error fetching plans:', err);
    process.exit(1);
  }
}

run();
