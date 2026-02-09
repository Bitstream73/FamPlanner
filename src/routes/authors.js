import { Router } from 'express';
import database from '../config/database.js';
import logger from '../services/logger.js';

const router = Router();

router.get('/', (req, res) => {
  const authors = database.db.prepare(`
    SELECT a.*, COUNT(q.id) AS quoteCount
    FROM authors a
    LEFT JOIN quotes q ON q.author = a.name
    GROUP BY a.id
    ORDER BY a.name ASC
  `).all();

  logger.info('api', 'authors_list', { count: authors.length });

  res.json({ authors });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const author = database.db.prepare('SELECT * FROM authors WHERE id = ?').get(id);

  if (!author) {
    return res.status(404).json({ error: 'Author not found' });
  }

  const quotes = database.db.prepare(
    'SELECT * FROM quotes WHERE author = ? ORDER BY created_at DESC'
  ).all(author.name);

  logger.info('api', 'author_detail', { authorId: id });

  res.json({ ...author, quotes });
});

export default router;
