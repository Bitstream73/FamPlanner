# Logging Specification

This document defines the application-wide logging system. Every service must use `src/services/logger.js`.

## Log Levels

| Level   | When                                      | Production |
|---------|-------------------------------------------|------------|
| `error` | Errors, exceptions, failures              | Always     |
| `warn`  | Warnings, near-failures, deprecations     | Always     |
| `info`  | Significant events (API calls, state)     | Always     |
| `debug` | Detailed debugging info                   | Disabled   |

## What Must Be Logged

**API Requests:** method, path, status code, timing, rate limit triggers, validation failures
**AI Service Calls:** provider, model version, request type, token usage, response time, errors/retries
**Database Operations:** migrations, connection events, query errors, slow queries (>100ms)
**Vector DB Operations:** upserts, queries, deletes — all with timing and counts
**System Events:** startup/shutdown, config loading, health checks, memory warnings

## Log Entry Structure

```javascript
{
  timestamp: ISO8601,
  level: 'error' | 'warn' | 'info' | 'debug',
  category: string,       // 'ai', 'api', 'db', 'vectordb', 'system'
  action: string,         // 'gemini_request', 'query_slow', etc.
  requestId: string,      // UUID per request for tracing
  ip: string | null,      // Masked in UI (first 2 octets only)
  details: object,        // Sanitized context — NEVER include tokens/keys
  duration: number | null, // Milliseconds for timed operations
  error: string | null    // Error message if applicable
}
```

## Storage

- Table: `application_logs` in SQLite
- Indexed on: `timestamp`, `level`, `category`
- Rotation: delete logs older than 30 days on startup

## Privacy — Non-Negotiable

- NEVER log API keys, tokens, or secrets
- Mask IP addresses in the UI (show only first 2 octets)
- Sanitize details object before writing: redact any key matching `key`, `token`, `secret`, `password`, `authorization`

## Logger API

```javascript
import logger from './services/logger.js';

logger.error(category, action, details, errorMessage);
logger.warn(category, action, details);
logger.info(category, action, details);
logger.debug(category, action, details);

// Child logger with preset context (e.g., per-request)
const reqLogger = logger.child({ requestId: 'abc-123' });
reqLogger.info('api', 'handler', { path: '/test' });
```
