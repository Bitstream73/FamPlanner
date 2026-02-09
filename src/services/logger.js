const SENSITIVE_PATTERNS = /key|token|secret|password|authorization|hash|code|session/i;

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const ROTATION_DAYS = 30;

function sanitize(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const cleaned = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_PATTERNS.test(k)) {
      cleaned[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      cleaned[k] = sanitize(v);
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

function shouldLog(level) {
  const threshold = process.env.NODE_ENV === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug;
  return LOG_LEVELS[level] <= threshold;
}

function formatEntry(level, category, action, details, errorMsg, context) {
  return {
    timestamp: new Date().toISOString(),
    level,
    category,
    action,
    requestId: context.requestId || null,
    ip: context.ip || null,
    details: sanitize(details || {}),
    duration: details?.duration || null,
    error: errorMsg || null,
  };
}

function writeToConsole(level, entry) {
  if (!shouldLog(level)) return;
  const json = JSON.stringify(entry);
  switch (level) {
    case 'error': console.error(`[${level.toUpperCase()}]`, json); break;
    case 'warn': console.warn(`[${level.toUpperCase()}]`, json); break;
    case 'debug': console.debug(`[${level.toUpperCase()}]`, json); break;
    default: console.info(`[${level.toUpperCase()}]`, json);
  }
}

function writeToDb(db, entry) {
  try {
    if (!db) return;
    db.prepare(
      `INSERT INTO application_logs (timestamp, level, category, action, request_id, ip_address, details, duration, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entry.timestamp,
      entry.level,
      entry.category,
      entry.action,
      entry.requestId,
      entry.ip,
      JSON.stringify(entry.details),
      entry.duration,
      entry.error
    );
  } catch {
    // Never throw from logger — silently fail on DB errors
  }
}

function rotateLogs(db) {
  try {
    if (!db) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ROTATION_DAYS);
    db.prepare('DELETE FROM application_logs WHERE timestamp < ?').run(cutoff.toISOString());
  } catch {
    // Rotation failure is non-fatal
  }
}

function createLogger(context = {}, db = null) {
  const log = (level, category, action, details, errorMsg) => {
    const entry = formatEntry(level, category, action, details, errorMsg, context);
    writeToConsole(level, entry);
    writeToDb(db, entry);
  };

  return {
    error(category, action, details, errorMsg) { log('error', category, action, details, errorMsg); },
    warn(category, action, details) { log('warn', category, action, details); },
    info(category, action, details) { log('info', category, action, details); },
    debug(category, action, details) { log('debug', category, action, details); },
    child(childContext) {
      return createLogger({ ...context, ...childContext }, db);
    },
    rotateLogs() { rotateLogs(db); },
  };
}

let logger;

try {
  const { default: database } = await import('../config/database.js');
  logger = createLogger({}, database.db);
  rotateLogs(database.db);
} catch {
  // Fallback: logger without DB (used in tests with mocked DB)
  logger = createLogger({}, null);
}

export default logger;
export { createLogger, sanitize };
