import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => { vi.resetModules(); process.env = { ...originalEnv }; });
  afterEach(() => { process.env = originalEnv; });

  it('should load config from environment variables', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '4000';
    process.env.GEMINI_API_KEY = 'test-key';
    const { default: config } = await import('../../src/config/index.js');
    expect(config.env).toBe('test');
    expect(config.port).toBe(4000);
  });

  it('should report missing required variables', async () => {
    delete process.env.GEMINI_API_KEY;
    const { validateEnv } = await import('../../src/utils/validateEnv.js');
    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('GEMINI_API_KEY');
  });

  it('should use default port when PORT is not set', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    delete process.env.PORT;
    const { default: config } = await import('../../src/config/index.js');
    expect(config.port).toBe(3000);
  });
});
