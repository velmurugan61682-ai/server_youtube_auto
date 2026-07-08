import jwt from 'jsonwebtoken';
import { authMiddleware } from '../middleware/auth.mjs';
import logger from '../utils/logger.mjs';

// Setup environment secret
process.env.JWT_SECRET = 'my_test_secret_123';
const JWT_SECRET = process.env.JWT_SECRET;

async function runTests() {
  console.log('--- Testing authMiddleware token validation ---');

  // Test Case 1: Token signed with mismatched secret
  const badToken = jwt.sign({ id: '123' }, 'wrong_secret_key');
  let statusCode = null;
  let responseJson = null;
  let nextCalled = false;

  const mockReq1 = {
    headers: {
      authorization: `Bearer ${badToken}`
    },
    cookies: {},
    method: 'GET',
    path: '/api/protected'
  };

  const mockRes1 = {
    status: (code) => {
      statusCode = code;
      return mockRes1;
    },
    json: (data) => {
      responseJson = data;
      return mockRes1;
    }
  };

  const mockNext1 = () => {
    nextCalled = true;
  };

  authMiddleware(mockReq1, mockRes1, mockNext1);

  if (statusCode === 401) {
    console.log('✅ Test Case 1 Passed: Returned 401 Unauthorized for mismatched JWT signature');
  } else {
    console.error(`❌ Test Case 1 Failed: Expected 401 but got ${statusCode}`);
    process.exit(1);
  }

  // Test Case 2: Expired Token
  const expiredToken = jwt.sign({ id: '123' }, JWT_SECRET, { expiresIn: '-1s' });
  statusCode = null;
  responseJson = null;
  nextCalled = false;

  const mockReq2 = {
    headers: {
      authorization: `Bearer ${expiredToken}`
    },
    cookies: {},
    method: 'GET',
    path: '/api/protected'
  };

  authMiddleware(mockReq2, mockRes1, mockNext1);

  if (statusCode === 401 && responseJson?.error === 'Token expired') {
    console.log('✅ Test Case 2 Passed: Returned 401 Unauthorized for expired token');
  } else {
    console.error(`❌ Test Case 2 Failed: Expected 401 and Token expired but got ${statusCode} with`, responseJson);
    process.exit(1);
  }

  // Test Case 3: Valid Token
  const validToken = jwt.sign({ id: '123' }, JWT_SECRET);
  statusCode = null;
  responseJson = null;
  nextCalled = false;

  const mockReq3 = {
    headers: {
      authorization: `Bearer ${validToken}`
    },
    cookies: {},
    method: 'GET',
    path: '/api/protected'
  };

  authMiddleware(mockReq3, mockRes1, mockNext1);

  if (nextCalled && !statusCode) {
    console.log('✅ Test Case 3 Passed: Successfully called next() for a valid token');
  } else {
    console.error(`❌ Test Case 3 Failed: next() not called or unexpected status ${statusCode}`);
    process.exit(1);
  }

  console.log('--- All authMiddleware test cases passed! ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
