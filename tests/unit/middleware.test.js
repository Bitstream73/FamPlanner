import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';

describe('Middleware', () => {
  describe('Error Handler', () => {
    it('should return 500 for unhandled errors', async () => {
      const { errorHandler } = await import('../../src/middleware/errorHandler.js');
      const app = express();
      app.get('/err', () => { throw new Error('boom'); });
      app.use(errorHandler);
      const res = await supertest(app).get('/err');
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });

    it('should return custom status via AppError', async () => {
      const { errorHandler, AppError } = await import('../../src/middleware/errorHandler.js');
      const app = express();
      app.get('/nf', () => { throw new AppError('Not found', 404); });
      app.use(errorHandler);
      const res = await supertest(app).get('/nf');
      expect(res.status).toBe(404);
    });

    it('should hide stack traces in production', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const { errorHandler } = await import('../../src/middleware/errorHandler.js');
      const app = express();
      app.get('/err', () => { throw new Error('secret'); });
      app.use(errorHandler);
      const res = await supertest(app).get('/err');
      expect(res.body).not.toHaveProperty('stack');
      process.env.NODE_ENV = origEnv;
    });
  });

  describe('Rate Limiter', () => {
    it('should allow requests under limit', async () => {
      const { createRateLimiter } = await import('../../src/middleware/rateLimiter.js');
      const app = express();
      app.use(createRateLimiter({ windowMs: 60000, max: 10 }));
      app.get('/t', (req, res) => res.json({ ok: true }));
      const res = await supertest(app).get('/t');
      expect(res.status).toBe(200);
    });

    it('should block requests over limit', async () => {
      const { createRateLimiter } = await import('../../src/middleware/rateLimiter.js');
      const app = express();
      app.use(createRateLimiter({ windowMs: 60000, max: 2 }));
      app.get('/t', (req, res) => res.json({ ok: true }));
      await supertest(app).get('/t');
      await supertest(app).get('/t');
      const res = await supertest(app).get('/t');
      expect(res.status).toBe(429);
    });
  });

  describe('Request Logger', () => {
    it('should attach a UUID requestId to each request', async () => {
      const { requestLogger } = await import('../../src/middleware/requestLogger.js');
      const app = express();
      app.use(requestLogger);
      app.get('/t', (req, res) => res.json({ requestId: req.requestId }));
      const res = await supertest(app).get('/t');
      expect(res.body.requestId).toMatch(/^[a-f0-9-]{36}$/);
    });
  });

  describe('Log Context', () => {
    it('should attach req.logger with info/warn/error methods', async () => {
      const { logContext } = await import('../../src/middleware/logContext.js');
      const { requestLogger } = await import('../../src/middleware/requestLogger.js');
      const app = express();
      app.use(requestLogger);
      app.use(logContext);
      app.get('/t', (req, res) => {
        res.json({
          hasLogger: !!req.logger,
          hasInfo: typeof req.logger?.info === 'function'
        });
      });
      const res = await supertest(app).get('/t');
      expect(res.body.hasLogger).toBe(true);
      expect(res.body.hasInfo).toBe(true);
    });
  });
});
