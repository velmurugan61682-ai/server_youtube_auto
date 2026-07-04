import './config/env.mjs';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
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
import { initCommentJob } from './jobs/commentJob.mjs';


// ── Global Error Handlers ─────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error({
    error: err.message || String(err),
    stack: err.stack,
    worker: 'global-uncaught-exception'
  });
  console.error('[Uncaught Exception]', err);
});

process.on('unhandledRejection', (reason) => {
  let errorMsg = '';
  if (reason instanceof Error) {
    errorMsg = reason.message;
  } else if (reason && typeof reason === 'object') {
    try {
      errorMsg = JSON.stringify(reason);
    } catch (_) {
      errorMsg = String(reason);
    }
  } else {
    errorMsg = String(reason);
  }

  logger.error({
    error: errorMsg,
    stack: reason?.stack,
    worker: 'global-unhandled-rejection'
  });
  console.error('[Unhandled Rejection]', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({
  path: path.resolve(__dirname, '.env')
});

if (process.env.MONGO_URI && !process.env.MONGODB_URI) {
  process.env.MONGODB_URI = process.env.MONGO_URI;
}

// Debug
console.log('================================');
console.log('ENV FILE:', path.resolve(__dirname, '.env'));
console.log('MONGODB_URI:', !!process.env.MONGODB_URI);
console.log('DEEPSEEK_API_KEY:', !!process.env.DEEPSEEK_API_KEY);
console.log('JWT_SECRET:', !!process.env.JWT_SECRET);
console.log('================================');

// ── Validate Environment ─────────────────────────────────────
const REQUIRED_ENV = [
  'MONGODB_URI',
  'DEEPSEEK_API_KEY'
];

const missingEnv = REQUIRED_ENV.filter(
  (key) => !process.env[key]
);

if (missingEnv.length > 0) {
  logger.error(
    `❌ CRITICAL STARTUP ERROR: Missing environment variables: ${missingEnv.join(', ')}`
  );

  process.exit(1);
}

const PORT = process.env.PORT || 5000;

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://client-youtube-automation.vercel.app/',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.EXTRA_ORIGINS
    ? process.env.EXTRA_ORIGINS.split(',')
    : [])
].map(origin => origin.trim().replace(/\/$/, ''));

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
  pingTimeout: 5000    // Timeout if no response in 5 seconds
});
logger.info('🚀 Socket.IO Server Initialized with Custom Ping/Pong (10s/5s) & CORS settings');

const JWT_SECRET =
  process.env.JWT_SECRET ||
  'stable_dev_secret_2026';

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

  // Log transport upgrades
  socket.conn.on('upgrade', (transport) => {
    logger.info(`🚀 [Socket Transport Upgrade] Client ${socket.id} upgraded transport to: ${transport.name}`);
  });

  // Log packet exchanges (e.g. low-level ping/pong heartbeats)
  socket.conn.on('packet', (packet) => {
    if (packet.type === 'pong') {
      logger.info(`⚡ [Socket Heartbeat] Pong received from client ${socket.id}`);
    }
  });

  socket.conn.on('packetCreate', (packet) => {
    if (packet.type === 'ping') {
      logger.info(`⚡ [Socket Heartbeat] Ping sent to client ${socket.id}`);
    }
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
app.use(helmet());

app.use(
  cors({
    origin: checkOrigin,
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());

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

    // Development Admin Reset
    try {
      const adminEmail = 'admin@youtubeai.test';
      const hashedPassword = await bcrypt.hash(
        'Admin@123',
        10
      );

      await User.findOneAndUpdate(
        { email: adminEmail },
        {
          $setOnInsert: { name: 'System Admin' },
          $set: { password: hashedPassword }
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
      }
    );
  } catch (err) {
    logger.error(
      '❌ Critical Startup Error:',
      {
        message: err.message,
        stack: err.stack
      }
    );

    process.exit(1);
  }
}

startServer();