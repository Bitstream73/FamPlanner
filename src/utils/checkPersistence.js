import fs from 'fs';
import path from 'path';
import logger from '../services/logger.js';

const MARKER_FILE = path.join(process.cwd(), 'data', '.persistence-marker');

export function checkPersistence() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(MARKER_FILE)) {
      const content = fs.readFileSync(MARKER_FILE, 'utf8');
      logger.info('system', 'persistence_check', {
        persistent: true,
        message: 'Data directory persists across restarts',
        lastBoot: content,
      });
    } else {
      logger.warn('system', 'persistence_check', {
        persistent: false,
        message: 'Data directory may be ephemeral. Attach a volume to /app/data for persistence.',
      });
    }

    fs.writeFileSync(MARKER_FILE, new Date().toISOString());
  } catch (err) {
    logger.warn('system', 'persistence_check_failed', {
      message: 'Could not verify storage persistence',
    });
  }
}
