# Authentication Specification

This document defines the user account and two-factor authentication system. Uses email-based 2FA via Resend.

## Overview

Users register with email + password. On login, a 6-digit code is sent to their email via Resend. They must enter the code to complete authentication. Sessions are managed with signed, httpOnly cookies.

## Database Tables

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| email | TEXT UNIQUE | Lowercase, trimmed |
| password_hash | TEXT | bcrypt, 12 rounds |
| display_name | TEXT | Optional |
| is_verified | INTEGER | 0 or 1, default 0 |
| created_at | INTEGER | unixepoch() |
| updated_at | INTEGER | unixepoch() |

### `two_factor_codes`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| user_id | INTEGER FK | References users(id) |
| code | TEXT | 6-digit, bcrypt-hashed |
| expires_at | INTEGER | Unix timestamp, 10 min TTL |
| used | INTEGER | 0 or 1 |
| created_at | INTEGER | unixepoch() |

### `sessions`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| user_id | INTEGER FK | References users(id) |
| expires_at | INTEGER | Unix timestamp, 7-day TTL |
| created_at | INTEGER | unixepoch() |

## Auth Flow

### Registration
1. `POST /api/auth/register` — `{ email, password, displayName? }`
2. Validate email format, password strength (min 8 chars, 1 uppercase, 1 number)
3. Hash password with bcrypt (12 rounds)
4. Insert user
5. Send verification code via Resend
6. Return `{ message: "Verification code sent", userId }`

### Login (Two-Factor)
1. `POST /api/auth/login` — `{ email, password }`
2. Verify password against hash
3. Generate 6-digit code, hash it, store in `two_factor_codes` (10 min TTL)
4. Invalidate any previous unused codes for this user
5. Send code via Resend
6. Return `{ message: "2FA code sent", requiresTwoFactor: true }`

### Verify 2FA Code
1. `POST /api/auth/verify-2fa` — `{ email, code }`
2. Find latest unused, non-expired code for user
3. Compare code via bcrypt
4. If valid: mark code as used, mark user as verified, create session
5. Set session cookie (httpOnly, secure, sameSite: strict, 7 days)
6. Return `{ message: "Authenticated", user: { id, email, displayName } }`

### Logout
1. `POST /api/auth/logout`
2. Delete session from DB
3. Clear session cookie

### Get Current User
1. `GET /api/auth/me`
2. Read session cookie → look up session → return user or 401

## Resend Email Service

```javascript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Send 2FA code
await resend.emails.send({
  from: process.env.RESEND_FROM_EMAIL,  // e.g., 'Quote Log <noreply@yourdomain.com>'
  to: userEmail,
  subject: 'Your Quote Log verification code',
  html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`
});
```

## Security Rules — Non-Negotiable

- **Passwords:** bcrypt with 12 rounds. NEVER store plaintext.
- **2FA codes:** bcrypt-hash before storing. NEVER log the plaintext code.
- **Sessions:** UUID v4, httpOnly cookie, secure in production, sameSite strict.
- **Rate limiting:** Max 5 login attempts per email per 15 minutes. Max 3 2FA verify attempts per email per 15 minutes.
- **Code expiry:** 10 minutes. One active code per user at a time.
- **Logging:** Log auth events (register, login_attempt, 2fa_sent, 2fa_verified, 2fa_failed, logout) but NEVER log passwords, codes, or session tokens.
- **Cookie secret:** Use `SESSION_SECRET` env var. Must be cryptographically random, min 32 chars.

## Middleware

### `src/middleware/authenticate.js`
- Read session ID from cookie
- Look up session in DB, check expiry
- Attach `req.user` (id, email, displayName) if valid
- Call `next()` either way — route handlers decide if auth is required

### `src/middleware/requireAuth.js`
- If `req.user` is null, return 401
- Use on protected routes

## What's Protected vs Public

| Route | Auth Required |
|-------|:---:|
| `GET /api/health` | No |
| `POST /api/auth/*` | No |
| `GET /api/quotes` | Yes |
| `GET /api/quotes/:id` | Yes |
| `GET /api/authors` | Yes |
| `GET /api/authors/:id` | Yes |
| `GET /api/settings` | Yes |
| `PUT /api/settings` | Yes |
| `GET /api/logs` | Yes |
| `GET /api/logs/stats` | Yes |
| `GET /api/logs/export` | Yes |
| `DELETE /api/logs` | Yes |
| Static files (/, CSS, JS) | No |
