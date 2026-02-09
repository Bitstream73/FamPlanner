import { v4 as uuidv4 } from 'uuid';
import logger from '../services/logger.js';

const SLOW_REQUEST_MS = 1000;

export function requestLogger(req, res, next) {
  req.requestId = uuidv4();
  const start = Date.now();

  const isHealth = req.path === '/api/health';

  if (!isHealth) {
    logger.info('api', 'request_start', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      requestId: req.requestId,
    });
  }

  res.on('finish', () => {
    const duration = Date.now() - start;

    if (!isHealth) {
      const logData = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        requestId: req.requestId,
      };

      if (duration > SLOW_REQUEST_MS) {
        logger.warn('api', 'slow_request', logData);
      } else {
        logger.info('api', 'request_complete', logData);
      }
    }
  });

  next();
}
