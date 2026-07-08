import jwt from 'jsonwebtoken';
import { sso } from '../controllers/authController.mjs';
import logger from '../utils/logger.mjs';
import User from '../models/User.mjs';

// Stub environment
process.env.JWT_SECRET = 'my_test_secret_123';

// Escape Regex verification helper
const escapeRegex = (string) => {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

async function runTests() {
  console.log('--- Testing Escape Regex Sanitization ---');
  const dirtyInput = '.*.*(hello)+^$';
  const cleanInput = escapeRegex(dirtyInput);
  console.log(`Input: "${dirtyInput}" -> Escaped: "${cleanInput}"`);
  if (cleanInput === '\\.\\*\\.\\*\\(hello\\)\\+\\^\\$') {
    console.log('✅ Regex Escaping Passed!');
  } else {
    console.error('❌ Regex Escaping Failed!');
    process.exit(1);
  }

  console.log('\n--- Testing sso endpoint hardening (Mock requests) ---');

  // Test Case 1: Production block
  process.env.NODE_ENV = 'production';
  let statusCode = null;
  let responseJson = null;

  const mockRes = {
    status: (code) => {
      statusCode = code;
      return mockRes;
    },
    json: (data) => {
      responseJson = data;
      return mockRes;
    }
  };

  await sso({
    body: { sso_username: 'admin@youtubeai.test', sso_key: '926313' },
    ip: '127.0.0.1'
  }, mockRes);

  if (statusCode === 403 && responseJson?.error?.includes('SSO is disabled in production')) {
    console.log('✅ Test Case 1 Passed: Correctly blocked SSO in production environment');
  } else {
    console.error(`❌ Test Case 1 Failed: Expected 403 but got ${statusCode}`, responseJson);
    process.exit(1);
  }

  // Test Case 2: Development with undefined DEV_SSO_KEY
  process.env.NODE_ENV = 'development';
  delete process.env.DEV_SSO_KEY;
  statusCode = null;
  responseJson = null;

  await sso({
    body: { sso_username: 'admin@youtubeai.test', sso_key: '926313' },
    ip: '127.0.0.1'
  }, mockRes);

  if (statusCode === 401 && responseJson?.error === 'Invalid SSO credentials') {
    console.log('✅ Test Case 2 Passed: Correctly rejected SSO when DEV_SSO_KEY is undefined in env');
  } else {
    console.error(`❌ Test Case 2 Failed: Expected 401 but got ${statusCode}`, responseJson);
    process.exit(1);
  }

  // Test Case 3: Development with incorrect DEV_SSO_KEY
  process.env.DEV_SSO_KEY = 'super_secret_sso_key';
  statusCode = null;
  responseJson = null;

  await sso({
    body: { sso_username: 'admin@youtubeai.test', sso_key: 'wrong_key' },
    ip: '127.0.0.1'
  }, mockRes);

  if (statusCode === 401 && responseJson?.error === 'Invalid SSO credentials') {
    console.log('✅ Test Case 3 Passed: Correctly rejected SSO when client provides incorrect sso_key');
  } else {
    console.error(`❌ Test Case 3 Failed: Expected 401 but got ${statusCode}`, responseJson);
    process.exit(1);
  }

  console.log('\n--- All local validation test cases passed successfully! ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
