import logger from '../services/logger.js';

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const requestId = req.requestId || null;

  logger.error('api', 'unhandled_error', {
    path: req.path,
    method: req.method,
    requestId,
  }, err.message);

  const response = {
    error: err.message || 'Internal Server Error',
    statusCode,
  };

  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
