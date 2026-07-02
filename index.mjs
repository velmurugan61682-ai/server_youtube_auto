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
import './jobs/commentAutomation.js';


// ── Global Error Handlers ─────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    worker: 'global-uncaught-exception'
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error({
    error: reason?.message || reason,
    stack: reason?.stack,
    worker: 'global-unhandled-rejection'
  });
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
  'https://youtubeai-client.vercel.app',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.EXTRA_ORIGINS
    ? process.env.EXTRA_ORIGINS.split(',')
    : [])
].map(origin => origin.trim().replace(/\/$/, ''));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

const JWT_SECRET =
  process.env.JWT_SECRET ||
  'stable_dev_secret_2026';

io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
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

    next();
  } catch (err) {
    next(
      new Error('Authentication error')
    );
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  if (socket.user && socket.user.id) {
    const roomName = socket.user.id.toString();
    socket.join(roomName);
    logger.info(`Socket connected: ${socket.id} joined room: ${roomName}`);
  }
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
    origin: allowedOrigins,
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());

// ── Routes ───────────────────────────────────────────────────
app.use('/api', routes);

app.get('/auth', (_req, res) => {
  res.redirect('/api/youtube/auth');
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