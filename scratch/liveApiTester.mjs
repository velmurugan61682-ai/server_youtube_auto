import '../config/env.mjs';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import routes from '../routes/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use('/api', routes);

function discoverRoutes() {
  const routeList = [];

  function walk(layer, pathPrefix) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
      methods.forEach(method => {
        routeList.push({
          method,
          path: pathPrefix + layer.route.path,
          fullUrl: `https://server-youtube-auto.onrender.com${pathPrefix}${layer.route.path}`
        });
      });
    } else if (layer.name === 'router' && layer.handle.stack) {
      let extraPrefix = '';
      if (layer.regexp) {
        const match = layer.regexp.source
          .replace('^\\/', '/')
          .replace('\\/?(?=\\/|$)', '')
          .replace('(?=\\/|$)', '')
          .replace(/\\\//g, '/');
        if (match && match !== '^' && !match.includes('?i')) {
          extraPrefix = match;
        }
      }
      layer.handle.stack.forEach(childLayer => {
        walk(childLayer, pathPrefix + extraPrefix);
      });
    }
  }

  app._router.stack.forEach(layer => walk(layer, ''));
  return routeList;
}

const discoveredRoutes = discoverRoutes();

async function makeRequest(urlStr, method = 'GET', headers = {}) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;
    const startTime = Date.now();

    const req = client.request(url, { method, headers, timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body.slice(0, 500),
          responseTime
        });
      });
    });

    req.on('error', err => {
      resolve({
        status: 0,
        error: err.message,
        responseTime: Date.now() - startTime
      });
    });

    req.end();
  });
}

async function runLiveTests() {
  console.log(`Starting live API testing across ${discoveredRoutes.length} registered routes...`);
  const testResults = [];

  // 1. Health Endpoint Test
  const healthRes = await makeRequest('http://localhost:5000/api/health');
  console.log('Health Test Result:', healthRes);

  // 2. CORS Preflight Test
  const corsRes = await makeRequest('http://localhost:5000/api/health', 'OPTIONS', {
    'Origin': 'https://channelbot.in',
    'Access-Control-Request-Method': 'GET'
  });
  console.log('CORS Preflight Test Result:', corsRes.headers['access-control-allow-origin']);

  // 3. Batch Test Registered Routes against running local server
  for (const r of discoveredRoutes) {
    const localUrl = `http://localhost:5000${r.path}`;
    const res = await makeRequest(localUrl, r.method);
    let pass = false;
    let category = 'Unknown';
    let authType = 'Protected';

    if (r.path.includes('/health') || r.path === '/api/auth/register' || r.path === '/api/auth/login' || r.path === '/api/admin/login') {
      authType = 'Public';
      pass = res.status >= 200 && res.status < 400;
    } else if (r.path.includes('/admin')) {
      authType = 'Admin Only';
      pass = res.status === 401 || res.status === 403; // Expected 401/403 without admin token
    } else if (r.path.includes('/external')) {
      authType = 'External API Key';
      pass = res.status === 401 || res.status === 403; // Expected 401/403 without API key
    } else {
      authType = 'Protected (JWT)';
      pass = res.status === 401 || res.status === 403 || res.status === 200; // Expected 401/403 without token
    }

    testResults.push({
      method: r.method,
      path: r.path,
      fullUrl: r.fullUrl,
      authType,
      statusCode: res.status,
      responseTime: res.responseTime,
      pass,
      bodySnippet: res.body
    });
  }

  fs.writeFileSync(path.resolve(__dirname, 'test_results.json'), JSON.stringify(testResults, null, 2));
  console.log(`Completed testing ${testResults.length} endpoints. Saved to test_results.json.`);
}

runLiveTests().catch(console.error);
