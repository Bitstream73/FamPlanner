import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/index.js';
import logger from './services/logger.js';
import { requestLogger } from './middleware/requestLogger.js';
import { logContext } from './middleware/logContext.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authenticate } from './middleware/authenticate.js';
import { requireAuth } from './middleware/requireAuth.js';
import authRoutes from './routes/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_VERSION = '1.0.0';

export function createApp() {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });

  // --- Middleware stack ---
  app.use(requestLogger);
  app.use(logContext);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(createRateLimiter());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser(config.sessionSecret));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(authenticate);

  // --- Health check ---
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: PKG_VERSION,
      uptime: process.uptime(),
    });
  });

  // --- Auth routes (public) ---
  app.use('/api/auth', authRoutes);

  // --- Protected route stubs (filled in Phase 6) ---
  app.use('/api/quotes', requireAuth, (req, res) => res.json([]));
  app.use('/api/authors', requireAuth, (req, res) => res.json([]));
  app.use('/api/settings', requireAuth, (req, res) => res.json({}));
  app.use('/api/logs', requireAuth, (req, res) => res.json([]));

  // --- Socket.IO ---
  io.on('connection', (socket) => {
    logger.debug('system', 'socket_connected', { socketId: socket.id });
    socket.on('disconnect', () => {
      logger.debug('system', 'socket_disconnected', { socketId: socket.id });
    });
  });

  // Make io accessible to routes
  app.set('io', io);

  // --- Error handler (must be last) ---
  app.use(errorHandler);

  return { app, httpServer, io };
}

if (config.env !== 'test') {
  const { app, httpServer } = createApp();

  httpServer.listen(config.port, () => {
    logger.info('system', 'startup', {
      version: PKG_VERSION,
      nodeVersion: process.version,
      env: config.env,
      port: config.port,
    });
  });

  const shutdown = (signal) => {
    logger.info('system', 'shutdown_initiated', { signal });
    httpServer.close(() => {
      logger.info('system', 'shutdown_complete', { signal });
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
