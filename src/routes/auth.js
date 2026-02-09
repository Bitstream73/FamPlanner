import { Router } from 'express';
import authService from '../services/auth.js';
import emailService from '../services/email.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import logger from '../services/logger.js';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  signed: true,
};

const registerLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
const verifyLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 3 });

// POST /api/auth/register
router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (!password || !PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with 1 uppercase letter and 1 number',
      });
    }

    const existing = authService.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await authService.hashPassword(password);
    const userId = authService.createUser(email, passwordHash, displayName);

    const code = authService.generateTwoFactorCode();
    const hashedCode = await authService.hashCode(code);
    authService.storeTwoFactorCode(userId, hashedCode);

    try {
      await emailService.sendVerificationCode(email.toLowerCase().trim(), code);
    } catch {
      logger.warn('email', 'dev_mode', { message: 'Email send failed, code logged for dev' });
    }

    res.status(201).json({ message: 'Verification code sent', userId });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    logger.info('auth', 'login_attempt', { email: email.toLowerCase().trim() });

    const user = authService.findUserByEmail(email);
    if (!user) {
      logger.warn('auth', 'login_failed', { email, reason: 'user_not_found' });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await authService.verifyPassword(password, user.password_hash);
    if (!validPassword) {
      logger.warn('auth', 'login_failed', { email, reason: 'invalid_password' });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const code = authService.generateTwoFactorCode();
    const hashedCode = await authService.hashCode(code);
    authService.storeTwoFactorCode(user.id, hashedCode);

    try {
      await emailService.sendVerificationCode(email.toLowerCase().trim(), code);
      logger.info('auth', '2fa_sent', { email: email.toLowerCase().trim() });
    } catch {
      logger.warn('email', 'dev_mode', { message: 'Email send failed, code logged for dev' });
    }

    res.json({ message: '2FA code sent', requiresTwoFactor: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-2fa
router.post('/verify-2fa', verifyLimiter, async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    const user = authService.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    const storedCode = authService.getLatestUnusedCode(user.id);
    if (!storedCode) {
      logger.warn('auth', '2fa_failed', { email, reason: 'no_valid_code' });
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    const valid = await authService.verifyCode(code, storedCode.code);
    if (!valid) {
      logger.warn('auth', '2fa_failed', { email, reason: 'code_mismatch' });
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    authService.markCodeUsed(storedCode.id);
    authService.markUserVerified(user.id);

    const sessionId = authService.createSession(user.id);
    res.cookie('session_id', sessionId, SESSION_COOKIE_OPTIONS);

    logger.info('auth', '2fa_verified', { email: email.toLowerCase().trim() });

    res.json({
      message: 'Authenticated',
      user: { id: user.id, email: user.email, displayName: user.display_name },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const sessionId = req.signedCookies?.session_id;
  if (sessionId) {
    authService.deleteSession(sessionId);
    logger.info('auth', 'logout', { userId: req.user?.id });
  }
  res.clearCookie('session_id');
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({
    user: { id: req.user.id, email: req.user.email, displayName: req.user.displayName },
  });
});

export default router;
