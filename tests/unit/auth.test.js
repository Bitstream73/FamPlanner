import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Auth Service', () => {
  let authService;

  beforeEach(async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test-secret-that-is-at-least-32-chars-long';
    const mod = await import('../../src/services/auth.js');
    authService = mod.default;
  });
  afterEach(() => vi.restoreAllMocks());

  it('should hash and verify a password', async () => {
    const hash = await authService.hashPassword('MyP@ssw0rd');
    expect(hash).not.toBe('MyP@ssw0rd');
    expect(await authService.verifyPassword('MyP@ssw0rd', hash)).toBe(true);
    expect(await authService.verifyPassword('wrong', hash)).toBe(false);
  });

  it('should generate a 6-digit code', () => {
    const code = authService.generateTwoFactorCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('should hash and verify a 2FA code', async () => {
    const code = '123456';
    const hash = await authService.hashCode(code);
    expect(hash).not.toBe(code);
    expect(await authService.verifyCode(code, hash)).toBe(true);
    expect(await authService.verifyCode('000000', hash)).toBe(false);
  });
});
