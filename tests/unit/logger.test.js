import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Logger Service', () => {
  let logger, mockDb;

  beforeEach(async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    mockDb = { prepare: vi.fn().mockReturnValue({ run: vi.fn() }) };
    vi.doMock('../../src/config/database.js', () => ({ default: { db: mockDb } }));
    const mod = await import('../../src/services/logger.js');
    logger = mod.default;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('should write log entries to the database', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('system', 'startup', { version: '1.0.0' });
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO application_logs'));
  });

  it('should redact sensitive fields in details', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('ai', 'request', { apiKey: 'AIzaSy_REAL_KEY', model: 'gemini' });
    const logged = JSON.parse(spy.mock.calls[0][1]);
    expect(logged.details.apiKey).toBe('[REDACTED]');
    expect(logged.details.model).toBe('gemini');
  });

  it('should include ISO8601 timestamp and all required fields', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('api', 'request', { path: '/test' });
    const logged = JSON.parse(spy.mock.calls[0][1]);
    expect(logged.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(logged).toHaveProperty('level', 'info');
    expect(logged).toHaveProperty('category', 'api');
    expect(logged).toHaveProperty('action', 'request');
  });

  it('should create child logger with preset context', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const child = logger.child({ requestId: 'req-abc' });
    child.info('api', 'handler', { path: '/x' });
    const logged = JSON.parse(spy.mock.calls[0][1]);
    expect(logged.requestId).toBe('req-abc');
  });

  it('should not throw if database write fails', () => {
    mockDb.prepare.mockImplementation(() => { throw new Error('DB down'); });
    expect(() => logger.info('test', 'action', {})).not.toThrow();
  });
});
