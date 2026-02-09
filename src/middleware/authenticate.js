import authService from '../services/auth.js';

export function authenticate(req, _res, next) {
  req.user = null;

  try {
    const sessionId = req.signedCookies?.session_id;
    if (sessionId) {
      req.user = authService.getSessionUser(sessionId);
    }
  } catch {
    // Authentication lookup failure is non-fatal
  }

  next();
}
