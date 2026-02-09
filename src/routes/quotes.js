import { Router } from 'express';
import database from '../config/database.js';
import logger from '../services/logger.js';

const router = Router();

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;

  const total = database.db.prepare('SELECT COUNT(*) AS count FROM quotes').get().count;
  const quotes = database.db.prepare(
    'SELECT * FROM quotes ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);

  const totalPages = Math.ceil(total / limit) || 1;

  logger.info('api', 'quotes_list', { page, limit, total });

  res.json({ quotes, total, page, totalPages });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const quote = database.db.prepare('SELECT * FROM quotes WHERE id = ?').get(id);

  if (!quote) {
    return res.status(404).json({ error: 'Quote not found' });
  }

  const sources = database.db.prepare(
    'SELECT * FROM quote_sources WHERE quote_id = ?'
  ).all(id);

  logger.info('api', 'quote_detail', { quoteId: id });

  res.json({ ...quote, sources });
});

export default router;
