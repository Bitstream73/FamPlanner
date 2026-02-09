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
import quotesRoutes from './routes/quotes.js';
import authorsRoutes from './routes/authors.js';
import settingsRoutes from './routes/settings.js';
import logsRoutes from './routes/logs.js';
import householdsRoutes from './routes/api/v1/households.js';
import calendarRoutes from './routes/api/v1/calendar.js';
import tasksRoutes from './routes/api/v1/tasks.js';
import routinesRoutes from './routes/api/v1/routines.js';
import announcementsRoutes from './routes/api/v1/announcements.js';
import commentsRoutes from './routes/api/v1/comments.js';
import handbookRoutes from './routes/api/v1/handbook.js';
import notificationsRoutes from './routes/api/v1/notifications.js';
import exportRoutes from './routes/api/v1/export.js';
import auditRoutes from './routes/api/v1/audit.js';

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
      services: {
        database: 'connected',
        socketio: 'active',
      },
    });
  });

  // --- Auth routes (public) ---
  app.use('/api/auth', authRoutes);

  // --- Protected routes ---
  app.use('/api/quotes', requireAuth, quotesRoutes);
  app.use('/api/authors', requireAuth, authorsRoutes);
  app.use('/api/settings', requireAuth, settingsRoutes);
  app.use('/api/logs', requireAuth, logsRoutes);

  // --- MVP v1 routes ---
  app.use('/api/v1/households', householdsRoutes);
  app.use('/api/v1', calendarRoutes);
  app.use('/api/v1', tasksRoutes);
  app.use('/api/v1', routinesRoutes);
  app.use('/api/v1', announcementsRoutes);
  app.use('/api/v1/comments', commentsRoutes);
  app.use('/api/v1', handbookRoutes);
  app.use('/api/v1/notifications', notificationsRoutes);
  app.use('/api/v1', exportRoutes);
  app.use('/api/v1', auditRoutes);

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
