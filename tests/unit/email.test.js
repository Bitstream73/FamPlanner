import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor() {
      this.emails = {
        send: vi.fn().mockResolvedValue({ id: 'email-123' })
      };
    }
  }
}));

describe('Email Service', () => {
  let emailService;

  beforeEach(async () => {
    vi.resetModules();
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.RESEND_FROM_EMAIL = 'test@example.com';
    const mod = await import('../../src/services/email.js');
    emailService = mod.default;
  });

  it('should send a 2FA verification email', async () => {
    const result = await emailService.sendVerificationCode('user@test.com', '123456');
    expect(result).toHaveProperty('id');
  });

  it('should throw when Resend send fails', async () => {
    vi.resetModules();
    vi.doMock('resend', () => ({
      Resend: class FailResend {
        constructor() {
          this.emails = {
            send: vi.fn().mockRejectedValue(new Error('Resend down'))
          };
        }
      }
    }));
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'test@example.com';
    const mod = await import('../../src/services/email.js');
    await expect(mod.default.sendVerificationCode('user@test.com', '123456')).rejects.toThrow();
  });
});
