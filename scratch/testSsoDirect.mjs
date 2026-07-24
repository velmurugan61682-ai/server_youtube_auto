import '../config/env.mjs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sso } from '../controllers/authController.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to Database');
    console.log('process.env.SSO_KEY:', process.env.SSO_KEY);
    console.log('process.env.DEV_SSO_KEY:', process.env.DEV_SSO_KEY);

    // Test 1: Test valid SSO credentials
    console.log('\n--- Test 1: Valid SSO ---');
    const req1 = {
      body: {
        sso_username: 'tech@gmail.com',
        sso_key: 'ciphergate_gowhats_secure_sso_key_2024'
      }
    };
    const res1 = {
      json: (data) => {
        console.log('SUCCESS Result:', JSON.stringify(data, null, 2));
      },
      status: (code) => ({
        json: (data) => {
          console.error(`FAILED with status: ${code}`, data);
        }
      })
    };
    await sso(req1, res1);

    // Test 2: Test invalid SSO key
    console.log('\n--- Test 2: Invalid SSO Key ---');
    const req2 = {
      body: {
        sso_username: 'tech@gmail.com',
        sso_key: 'invalid_key_value'
      }
    };
    const res2 = {
      json: (data) => {
        console.log('SUCCESS Result (unexpected):', data);
      },
      status: (code) => ({
        json: (data) => {
          console.log(`FAILED with status (expected): ${code}`, data);
        }
      })
    };
    await sso(req2, res2);

    process.exit(0);
  } catch (err) {
    console.error('Error running SSO test:', err);
    process.exit(1);
  }
}

run();
