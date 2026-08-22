import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../middleware/auth.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

// Create a valid JWT token for testing
const testToken = jwt.sign(
  { id: '507f191e810c19729de860ea', email: 'test@example.com', role: 'client' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

function runUnitTest(headerValue, cookies = {}) {
  return new Promise((resolve) => {
    const req = {
      headers: headerValue !== undefined ? { authorization: headerValue } : {},
      cookies,
      method: 'GET',
      path: '/api/auth/me'
    };

    let responseStatus = null;
    let responseBody = null;

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(body) {
        responseBody = body;
        resolve({ passed: false, status: responseStatus, body });
      }
    };

    const next = () => {
      resolve({ passed: true, status: 200, user: req.user });
    };

    authMiddleware(req, res, next);
  });
}

async function runRegressionTestSuite() {
  console.log('=== Bearer Token Auth Middleware Regression Test Suite ===\n');

  const tests = [
    {
      name: '1. Valid Bearer <token> with single space',
      header: `Bearer ${testToken}`,
      shouldPass: true
    },
    {
      name: '2. Bearer with multiple spaces/tabs before token',
      header: `Bearer \t  ${testToken}`,
      shouldPass: true
    },
    {
      name: '3. Lowercase bearer <token>',
      header: `bearer ${testToken}`,
      shouldPass: true
    },
    {
      name: '4. Token with trailing \\r\\n or whitespace',
      header: `Bearer ${testToken} \r\n\t `,
      shouldPass: true
    },
    {
      name: '5. Missing Authorization header entirely',
      header: undefined,
      shouldPass: false
    },
    {
      name: '6. Malformed header (Token <token> instead of Bearer)',
      header: `Token ${testToken}`,
      shouldPass: false
    },
    {
      name: '7. Empty Bearer value (Bearer  with nothing after)',
      header: 'Bearer   ',
      shouldPass: false
    }
  ];

  let passedCount = 0;
  let failedCount = 0;

  for (const t of tests) {
    const res = await runUnitTest(t.header);
    const success = t.shouldPass ? res.passed : (!res.passed && res.status === 401);

    if (success) {
      console.log(`✅ [PASS] ${t.name}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${t.name} -> Expected pass: ${t.shouldPass}, Got result:`, res);
      failedCount++;
    }
  }

  console.log(`\nSummary: All ${passedCount}/${tests.length} tests passed successfully.`);
  if (failedCount > 0) {
    process.exit(1);
  }
}

runRegressionTestSuite().catch(console.error);
