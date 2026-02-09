import { Router } from 'express';
import database from '../config/database.js';
import logger from '../services/logger.js';

const router = Router();

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (req.query.level) {
    conditions.push('level = ?');
    params.push(req.query.level);
  }
  if (req.query.category) {
    conditions.push('category = ?');
    params.push(req.query.category);
  }
  if (req.query.action) {
    conditions.push('action = ?');
    params.push(req.query.action);
  }
  if (req.query.startDate) {
    conditions.push('timestamp >= ?');
    params.push(req.query.startDate);
  }
  if (req.query.endDate) {
    conditions.push('timestamp <= ?');
    params.push(req.query.endDate);
  }
  if (req.query.search) {
    conditions.push('(action LIKE ? OR details LIKE ? OR error LIKE ?)');
    const term = `%${req.query.search}%`;
    params.push(term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = database.db.prepare(
    `SELECT COUNT(*) AS count FROM application_logs ${whereClause}`
  ).get(...params).count;

  const logs = database.db.prepare(
    `SELECT * FROM application_logs ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  const totalPages = Math.ceil(total / limit) || 1;

  res.json({ logs, total, page, totalPages });
});

router.get('/stats', (req, res) => {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const errorCount24h = database.db.prepare(
    "SELECT COUNT(*) AS count FROM application_logs WHERE level = 'error' AND timestamp >= ?"
  ).get(twentyFourHoursAgo).count;

  const warningCount24h = database.db.prepare(
    "SELECT COUNT(*) AS count FROM application_logs WHERE level = 'warn' AND timestamp >= ?"
  ).get(twentyFourHoursAgo).count;

  const requestsPerHour = database.db.prepare(
    "SELECT COUNT(*) AS count FROM application_logs WHERE category = 'api' AND timestamp >= ?"
  ).get(twentyFourHoursAgo).count / 24;

  const topCategories = database.db.prepare(
    `SELECT category, COUNT(*) AS count FROM application_logs
     WHERE timestamp >= ?
     GROUP BY category ORDER BY count DESC LIMIT 10`
  ).all(twentyFourHoursAgo);

  res.json({ errorCount24h, warningCount24h, requestsPerHour: Math.round(requestsPerHour), topCategories });
});

router.get('/export', (req, res) => {
  const conditions = [];
  const params = [];

  if (req.query.startDate) {
    conditions.push('timestamp >= ?');
    params.push(req.query.startDate);
  }
  if (req.query.endDate) {
    conditions.push('timestamp <= ?');
    params.push(req.query.endDate);
  }
  if (req.query.level) {
    conditions.push('level = ?');
    params.push(req.query.level);
  }
  if (req.query.category) {
    conditions.push('category = ?');
    params.push(req.query.category);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const logs = database.db.prepare(
    `SELECT * FROM application_logs ${whereClause} ORDER BY timestamp DESC`
  ).all(...params);

  const headers = ['id', 'timestamp', 'level', 'category', 'action', 'request_id', 'ip_address', 'details', 'duration', 'error'];
  const csvRows = [headers.join(',')];

  for (const log of logs) {
    const row = headers.map((h) => {
      const val = log[h];
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    });
    csvRows.push(row.join(','));
  }

  const csv = csvRows.join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="logs.csv"');
  res.send(csv);
});

router.delete('/', (req, res) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const result = database.db.prepare(
    'DELETE FROM application_logs WHERE timestamp < ?'
  ).run(sevenDaysAgo);

  logger.info('api', 'logs_cleared', { deleted: result.changes });

  res.json({ message: 'Old logs cleared', deleted: result.changes });
});

export default router;
