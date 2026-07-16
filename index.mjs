import './config/env.mjs';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './utils/logger.mjs';
import { Server } from 'socket.io';
import http from 'http';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import User from './models/User.mjs';
import routes from './routes/index.mjs';
import jwt from 'jsonwebtoken';
import compression from 'compression';
import { initCommentJob } from './jobs/commentJob.mjs';
import { initAutoDmCron } from './jobs/autoDmCron.js';
import { seedOrganizations } from './utils/tenantSeeder.mjs';


// ── Global Error Handlers ─────────────────────────────────────
process.on('uncaughtException', (err) => {
  const errorMsg = err instanceof Error ? err.message : String(err);
  const errorStack = err instanceof Error ? err.stack : undefined;
  logger.error(`[Uncaught Exception] ${errorMsg}`, { stack: errorStack, worker: 'global-uncaught-exception' });
  console.error('[Uncaught Exception]', errorMsg, errorStack || '');
  // Give logger time to flush, then exit
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason) => {
  let errorMsg = '';
  let errorStack;
  if (reason instanceof Error) {
    errorMsg = reason.message;
    errorStack = reason.stack;
  } else if (reason && typeof reason === 'object') {
    try {
      errorMsg = JSON.stringify(reason, null, 2);
    } catch (_) {
      errorMsg = String(reason);
    }
  } else {
    errorMsg = String(reason);
  }
  logger.error(`[Unhandled Rejection] ${errorMsg}`, { stack: errorStack, worker: 'global-unhandled-rejection' });
  console.error('[Unhandled Rejection]', errorMsg, errorStack || '');
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({
  path: path.resolve(__dirname, '.env')
});

// Map legacy variables for backward compatibility
if (process.env.YOUTUBE_OAUTH_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID) {
  process.env.GOOGLE_CLIENT_ID = process.env.YOUTUBE_OAUTH_CLIENT_ID;
}
if (process.env.YOUTUBE_OAUTH_CLIENT_SECRET && !process.env.GOOGLE_CLIENT_SECRET) {
  process.env.GOOGLE_CLIENT_SECRET = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
}
if (process.env.MONGO_URI && !process.env.MONGODB_URI) {
  process.env.MONGODB_URI = process.env.MONGO_URI;
}

// Automatically configure GOOGLE_REDIRECT_URI if not defined
if (!process.env.GOOGLE_REDIRECT_URI) {
  const isProduction = process.env.NODE_ENV === 'production';
  process.env.GOOGLE_REDIRECT_URI = isProduction
    ? (process.env.GOOGLE_REDIRECT_URI_PROD || '')
    : (process.env.GOOGLE_REDIRECT_URI_DEV || 'http://localhost:5000/api/youtube/callback');
}

// ── Validate Environment ─────────────────────────────────────
const variablesToCheck = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'JWT_SECRET',
  'MONGODB_URI'
];

let hasCriticalErrors = false;
const missingCriticalList = [];

variablesToCheck.forEach(key => {
  const isLoaded = !!process.env[key];
  if (isLoaded) {
    console.log(`✓ ${key} Loaded`);
  } else {
    console.log(`✗ ${key} Missing`);
    
    // Determine if the missing variable is critical and should stop the server
    const isCriticalAlways = (key === 'MONGODB_URI' || key === 'JWT_SECRET');
    const isCriticalInProd = (process.env.NODE_ENV === 'production' && (key === 'GOOGLE_CLIENT_ID' || key === 'GOOGLE_CLIENT_SECRET'));
    
    if (isCriticalAlways || isCriticalInProd) {
      hasCriticalErrors = true;
      missingCriticalList.push(key);
    }
  }
});

if (hasCriticalErrors) {
  logger.error(`❌ CRITICAL STARTUP ERROR: Missing critical environment variables: ${missingCriticalList.join(', ')}`);
  console.error(`❌ CRITICAL STARTUP ERROR: Missing critical environment variables: ${missingCriticalList.join(', ')}`);
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

const app = express();
const server = http.createServer(app);

const normalizeOrigin = (urlStr) => {
  try {
    const url = new URL(urlStr.trim());
    return url.origin;
  } catch (e) {
    return urlStr.trim().replace(/\/$/, '');
  }
};

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://client-youtube-auto-4esx.vercel.app/',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.EXTRA_ORIGINS
    ? process.env.EXTRA_ORIGINS.split(',')
    : [])
].map(normalizeOrigin);

const checkOrigin = (origin, callback) => {
  if (!origin) {
    logger.info('🌐 [CORS Check] Allowed request with no origin header');
    return callback(null, true);
  }
  const isAllowed = allowedOrigins.some(allowedOrigin => {
    if (allowedOrigin === origin) return true;
    // Allow any vercel subdomains dynamically
    if (origin.endsWith('.vercel.app')) return true;
    return false;
  });
  if (isAllowed || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
    logger.info(`🌐 [CORS Check] Allowed origin: ${origin}`);
    callback(null, true);
  } else {
    logger.warn(`⚠️ [CORS Check] Rejected origin: ${origin}`);
    callback(null, false);
  }
};

const io = new Server(server, {
  cors: {
    origin: checkOrigin,
    credentials: true,
    methods: ["GET", "POST"]
  },
  pingInterval: 10000, // Send a ping every 10 seconds to keep Render connection alive
  pingTimeout: 20000    // Increased to 20 seconds to prevent premature timeout disconnections
});
logger.info('🚀 Socket.IO Server Initialized with Custom Ping/Pong (10s/5s) & CORS settings');

const JWT_SECRET = process.env.JWT_SECRET;

io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    logger.warn(`🔑 [Socket Auth Failure] Connection rejected: No auth token provided. Socket ID: ${socket.id}`);
    return next(
      new Error('Authentication error')
    );
  }

  try {
    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    socket.user = decoded;
    logger.info('✓ JWT verified');
    logger.info(`🔑 [Socket Auth Success] Token verified for User: ${decoded.id || decoded.email || 'Unknown'}. Socket ID: ${socket.id}`);
    next();
  } catch (err) {
    logger.warn(`🔑 [Socket Auth Failure] Token verification failed: ${err.message}. Socket ID: ${socket.id}`);
    next(
      new Error('Authentication error')
    );
  }
});


app.set('io', io);

io.on('connection', (socket) => {
  logger.info(`🔌 [Socket Connection] Client connected. Socket ID: ${socket.id}. IP: ${socket.handshake.address}. Origin: ${socket.handshake.headers.origin || 'None'}`);

  if (socket.user && socket.user.id) {
    const roomName = socket.user.id.toString();
    socket.join(roomName);
    logger.info(`🏠 [Socket Room] Socket ${socket.id} joined room: ${roomName}`);
  }

  // Log transport upgrades (but NOT every heartbeat — those flood the logs)
  socket.conn.on('upgrade', (transport) => {
    logger.info(`🚀 [Socket Transport Upgrade] Client ${socket.id} upgraded transport to: ${transport.name}`);
  });

  socket.on('error', (err) => {
    logger.error(`❌ [Socket Error] Error on socket ${socket.id}: ${err.message}`);
  });

  socket.on('disconnect', (reason) => {
    logger.info(`🔌 [Socket Disconnection] Client disconnected. Socket ID: ${socket.id}. Reason: ${reason}`);
  });
});

async function watchDatabaseChanges(io) {
  try {
    logger.info('⏳ Starting MongoDB Change Streams...');
    
    const commentsChangeStream = mongoose.connection.collection('comments').watch([], {
      fullDocument: 'updateLookup'
    });
    
    commentsChangeStream.on('change', async (change) => {
      try {
        if (!['insert', 'update', 'replace'].includes(change.operationType)) return;
        const doc = change.fullDocument;
        if (!doc) return;
        
        const userIdStr = doc.userId ? doc.userId.toString() : '';
        if (!userIdStr) return;
        
        io.to(userIdStr).emit('live_activity', {
          ...doc,
          id: doc._id,
          type: doc.status === 'deleted' ? 'delete' : (doc.autoLiked ? 'like' : 'new_comment')
        });
        io.to(userIdStr).emit('new_comment_analyzed', doc);
        io.to(userIdStr).emit('stats_updated');
      } catch (err) {
        logger.error('Change stream comments error:', err);
      }
    });

    const leadsChangeStream = mongoose.connection.collection('leads').watch([], {
      fullDocument: 'updateLookup'
    });

    leadsChangeStream.on('change', async (change) => {
      try {
        if (!['insert', 'update', 'replace'].includes(change.operationType)) return;
        const doc = change.fullDocument;
        if (!doc) return;
        
        const userIdStr = doc.userId ? doc.userId.toString() : '';
        if (!userIdStr) return;
        
        io.to(userIdStr).emit('stats_updated');
      } catch (err) {
        logger.error('Change stream leads error:', err);
      }
    });
    
    logger.info('✅ MongoDB Change Streams initialized successfully');
  } catch (err) {
    logger.warn('⚠️ MongoDB Change Streams could not start. Falling back to Mongoose hooks.');
    
    const Comment = mongoose.model('Comment');
    const Lead = mongoose.model('Lead');
    
    const triggerSocketBroadcast = (doc, type) => {
      try {
        const userIdStr = doc.userId ? doc.userId.toString() : '';
        if (!userIdStr) return;
        
        io.to(userIdStr).emit('live_activity', {
          ...doc.toObject(),
          id: doc._id,
          type: doc.status === 'deleted' ? 'delete' : (doc.autoLiked ? 'like' : 'new_comment')
        });
        io.to(userIdStr).emit('new_comment_analyzed', doc);
        io.to(userIdStr).emit('stats_updated');
      } catch (e) {
        logger.error('Mongoose hook broadcast error:', e);
      }
    };
    
    Comment.schema.post('save', function(doc) {
      triggerSocketBroadcast(doc, 'comment');
    });
    
    Comment.schema.post('findOneAndUpdate', function(doc) {
      if (doc) triggerSocketBroadcast(doc, 'comment');
    });
    
    Lead.schema.post('save', function(doc) {
      try {
        const userIdStr = doc.userId ? doc.userId.toString() : '';
        if (userIdStr) io.to(userIdStr).emit('stats_updated');
      } catch (e) {}
    });
  }
}

// ── Middleware ───────────────────────────────────────────────
app.use(compression());
app.use(helmet());

app.use(
  cors({
    origin: checkOrigin,
    credentials: true,
    exposedHeaders: ['x-rtb-fingerprint-id', 'request-id']
  })
);

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(cookieParser());

// Rate Limiting Configurations
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased threshold for testing/production high loads
  standardHeaders: true,
  legacyHeaders: false,
  // Bypass rate limits for local developer/testing requests
  skip: (req) => process.env.DISABLE_RATE_LIMIT === 'true' || req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === 'localhost',
  message: { error: 'Too many requests, please try again after 15 minutes.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Increased threshold for auth testing
  standardHeaders: true,
  legacyHeaders: false,
  // Bypass rate limits for local developer/testing requests
  skip: (req) => process.env.DISABLE_RATE_LIMIT === 'true' || req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === 'localhost',
  message: { error: 'Too many authentication attempts, please try again after 15 minutes.' }
});

// Apply rate limiters
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', apiLimiter);

// ── Routes ───────────────────────────────────────────────────
app.use('/api', routes);

try {
  const deepseekRoutes = (await import('./routes/deepseekSchedule.js')).default;
  app.use('/api/deepseek', deepseekRoutes);
  console.log('Deepseek routes registered successfully');
} catch (err) {
  console.error('FAILED to register deepseek routes:', err);
}

app.get('/auth', (_req, res) => {
  res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
});

app.get('/auth/google/callback', (req, res) => {
  const query = new URLSearchParams(req.query).toString();
  res.redirect(`/api/youtube/callback?${query}`);
});

app.get('/', (_req, res) => {
  res.send('AI YouTube Moderator API is running.');
});

// ── Startup Sequence ─────────────────────────────────────────
async function startServer() {
  try {
    logger.info('⏳ Connecting to MongoDB...');

    await mongoose.connect(
      process.env.MONGODB_URI,
      {
        serverSelectionTimeoutMS: 10000
      }
    );

    logger.info(
      '✅ MongoDB Connected Successfully'
    );

    // Start MongoDB Change Streams (with hooks fallback)
    watchDatabaseChanges(io);

    // Seed organizations
    let techOrgId = null;
    try {
      const seedRes = await seedOrganizations();
      techOrgId = seedRes.techOrgId;
    } catch (seedErr) {
      logger.error('Organization seeding failed during startup:', seedErr);
    }

    // Development Admin Reset
    try {
      const adminEmail = 'admin@youtubeai.test';
      const hashedPassword = await bcrypt.hash(
        'Admin@123',
        10
      );

      const adminUpdate = {
        password: hashedPassword
      };
      if (techOrgId) {
        adminUpdate.organizationId = techOrgId;
      }

      await User.findOneAndUpdate(
        { email: adminEmail },
        {
          $setOnInsert: { name: 'System Admin', role: 'admin' },
          $set: adminUpdate
        },
        { upsert: true, returnDocument: 'after' }
      );

      logger.info(
        '🚀 ADMIN ACCOUNT RESET: admin@youtubeai.test / Admin@123'
      );
    } catch (adminErr) {
      logger.warn(`Admin account seed warning: ${adminErr.message}`);
    }

    server.listen(
      PORT,
      '0.0.0.0',
      () => {
        logger.info(
          `🚀 Server running on port ${PORT}`
        );

        logger.info(
          `🔗 API Base: http://localhost:${PORT}/api`
        );

        initCommentJob(io);
        initAutoDmCron();
      }
    );
  } catch (err) {
    logger.error(
      `❌ Critical Startup Error: ${err.message}`,
      {
        stack: err.stack
      }
    );

    process.exit(1);
  }
}

// ── Graceful Shutdown ─────────────────────────────────────────
// Prevents EADDRINUSE on nodemon restarts by properly closing
// the HTTP server and MongoDB connection before exiting.
const gracefulShutdown = (signal) => {
  logger.info(`\n🛑 ${signal} received. Starting graceful shutdown...`);

  server.close((err) => {
    if (err) {
      logger.error(`Error closing HTTP server: ${err.message}`);
    } else {
      logger.info('✅ HTTP server closed.');
    }

    mongoose.connection.close(false).then(() => {
      logger.info('✅ MongoDB connection closed.');
      logger.info('✅ Graceful shutdown complete.');
      process.exit(0);
    }).catch((mongoErr) => {
      logger.error(`Error closing MongoDB: ${mongoErr.message}`);
      process.exit(1);
    });
  });

  // Force kill after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error('⚠️ Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();