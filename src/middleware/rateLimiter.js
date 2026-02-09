import rateLimit from 'express-rate-limit';
import logger from '../services/logger.js';

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX = 100;

export function createRateLimiter(options = {}) {
  return rateLimit({
    windowMs: options.windowMs || DEFAULT_WINDOW_MS,
    max: options.max || DEFAULT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('api', 'rate_limit_hit', {
        ip: req.ip,
        path: req.path,
        method: req.method,
      });
      res.status(429).json({ error: 'Too many requests, please try again later.' });
    },
  });
}
