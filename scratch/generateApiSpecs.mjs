import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import routes from '../routes/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use('/api', routes);

function printRoutes(stack) {
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

const routesList = printRoutes(app._router.stack);

// 1. Generate Postman Collection v2.1.0
const postmanCollection = {
  info: {
    name: "ChannelMate Production API",
    _postman_id: "channelmate-prod-api-v1",
    description: "Production API documentation and test collection for ChannelMate YouTube SaaS Backend",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    {
      key: "baseUrl",
      value: "https://server-youtube-auto.onrender.com/api",
      type: "string"
    },
    {
      key: "authToken",
      value: "YOUR_JWT_TOKEN_HERE",
      type: "string"
    },
    {
      key: "adminToken",
      value: "YOUR_ADMIN_JWT_TOKEN_HERE",
      type: "string"
    },
    {
      key: "apiKey",
      value: "YOUR_EXTERNAL_API_KEY_HERE",
      type: "string"
    }
  ],
  item: []
};

// Categorize routes into folders
const categories = {
  "Authentication": r => r.path.startsWith('/api/auth') && !r.path.includes('/google'),
  "Google & YouTube OAuth": r => r.path.includes('/google') || r.path.includes('/youtube/auth') || r.path.includes('/youtube/callback') || r.path.includes('/youtube/connect'),
  "YouTube Channels & Content": r => r.path.startsWith('/api/channels') || (r.path.startsWith('/api/youtube') && !r.path.includes('/auth') && !r.path.includes('/callback') && !r.path.includes('/connect')),
  "Comments & Intelligence": r => r.path.startsWith('/api/comments') || r.path.startsWith('/api/comment-history'),
  "Automation & Auto-Mod": r => r.path.startsWith('/api/automation') || r.path.startsWith('/api/comment-automation') || r.path.startsWith('/api/auto-mod') || r.path.startsWith('/api/legacy-automation'),
  "Analytics & Dashboard": r => r.path.startsWith('/api/analytics') || r.path.startsWith('/api/dashboard'),
  "Leads & Customer Contacts": r => r.path.startsWith('/api/leads'),
  "Subscriptions & Billing": r => r.path.startsWith('/api/subscription') || r.path.startsWith('/api/billing'),
  "API Keys": r => r.path.startsWith('/api/api-keys'),
  "Settings & Configuration": r => r.path.startsWith('/api/settings'),
  "Live Chat": r => r.path.startsWith('/api/live-chat'),
  "Admin & Console Management": r => r.path.includes('/admin'),
  "External & Integration APIs": r => r.path.includes('/external'),
  "Health & System": r => r.path.includes('/health')
};

const grouped = {};
routesList.forEach(r => {
  let matchedCat = "Other Operations";
  for (const [catName, fn] of Object.entries(categories)) {
    if (fn(r)) {
      matchedCat = catName;
      break;
    }
  }
  if (!grouped[matchedCat]) grouped[matchedCat] = [];
  grouped[matchedCat].push(r);
});

for (const [catName, itemRoutes] of Object.entries(grouped)) {
  const folder = {
    name: catName,
    item: itemRoutes.map(r => {
      const cleanPath = r.path.replace(/^\/api\//, '');
      const pathSegments = cleanPath.split('/').map(s => s.startsWith(':') ? `{{${s.slice(1)}}}` : s);

      const headers = [];
      if (r.path.includes('/admin')) {
        headers.push({ key: "Authorization", value: "Bearer {{adminToken}}" });
      } else if (r.path.includes('/external')) {
        headers.push({ key: "x-api-key", value: "{{apiKey}}" });
      } else if (!r.path.includes('/health') && !r.path.includes('/callback') && !r.path.endsWith('/login') && !r.path.endsWith('/register')) {
        headers.push({ key: "Authorization", value: "Bearer {{authToken}}" });
      }
      headers.push({ key: "Content-Type", value: "application/json" });

      return {
        name: `${r.method} /${cleanPath}`,
        request: {
          method: r.method,
          header: headers,
          url: {
            raw: `{{baseUrl}}/${cleanPath}`,
            host: ["{{baseUrl}}"],
            path: pathSegments
          }
        }
      };
    })
  };
  postmanCollection.item.push(folder);
}

fs.writeFileSync(path.resolve(__dirname, '../ChannelMate_Production_Postman_Collection.json'), JSON.stringify(postmanCollection, null, 2));
console.log('✅ Generated ChannelMate_Production_Postman_Collection.json');

// 2. Generate OpenAPI 3.0 Spec
const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "ChannelMate Production REST API",
    version: "1.0.0",
    description: "Production API specification for ChannelMate YouTube SaaS Automation Server"
  },
  servers: [
    {
      url: "https://server-youtube-auto.onrender.com/api",
      description: "Production Render Server"
    }
  ],
  paths: {},
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      },
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key"
      }
    }
  }
};

routesList.forEach(r => {
  const openApiPath = r.path.replace(/^\/api/, '').replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
  if (!openApiSpec.paths[openApiPath]) {
    openApiSpec.paths[openApiPath] = {};
  }
  const methodLower = r.method.toLowerCase();
  
  const isProtected = !r.path.includes('/health') && !r.path.includes('/callback') && !r.path.endsWith('/login') && !r.path.endsWith('/register');
  const isAdmin = r.path.includes('/admin');
  const isExternal = r.path.includes('/external');

  openApiSpec.paths[openApiPath][methodLower] = {
    summary: `${r.method} ${openApiPath}`,
    tags: [r.path.split('/')[2] || 'general'],
    security: isExternal ? [{ ApiKeyAuth: [] }] : (isProtected ? [{ BearerAuth: [] }] : []),
    responses: {
      "200": {
        description: "Successful Operation",
        content: {
          "application/json": {
            schema: {
              type: "object"
            }
          }
        }
      },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" }
    }
  };
});

fs.writeFileSync(path.resolve(__dirname, '../openapi.json'), JSON.stringify(openApiSpec, null, 2));
console.log('✅ Generated openapi.json');
