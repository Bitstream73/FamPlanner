import { Router } from 'express';
import database from '../config/database.js';
import logger from '../services/logger.js';

const router = Router();

router.get('/', (req, res) => {
  const rows = database.db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  logger.info('api', 'settings_get', { count: rows.length });

  res.json(settings);
});

router.put('/', (req, res) => {
  const entries = Object.entries(req.body);
  if (entries.length === 0) {
    return res.status(400).json({ error: 'No settings provided' });
  }

  const upsert = database.db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, unixepoch())
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()
  `);

  const updateMany = database.db.transaction((items) => {
    for (const [key, value] of items) {
      upsert.run(key, String(value));
    }
  });

  updateMany(entries);

  logger.info('api', 'settings_update', { keys: entries.map(([k]) => k) });

  res.json({ message: 'Settings updated', updated: entries.length });
});

export default router;
