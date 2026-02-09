# Phase 8: Railway Deployment & Verification

## Objective
Deploy to Railway and verify the entire application is functional in production.

## Plan First
Propose deployment steps and verification checklist. Wait for approval.

## Steps — Deployment

### 1. Ensure Dockerfile is production-ready
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN mkdir -p data uploads && chown -R nodejs:nodejs /app
USER nodejs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
CMD ["node", "src/index.js"]
```

### 2. Ensure `railway.json` is correct
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "startCommand": "node src/index.js",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### 3. Deploy
```bash
railway init --name quote-log
railway link
railway up

# Set production env vars
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set DATABASE_PATH=/app/data/database.sqlite
# Use the real keys from Phase 0:
railway variables set GEMINI_API_KEY=$GEMINI_API_KEY
railway variables set PINECONE_API_KEY=$PINECONE_API_KEY
railway variables set PINECONE_INDEX_HOST=$PINECONE_INDEX_HOST
railway variables set RESEND_API_KEY=$RESEND_API_KEY
railway variables set RESEND_FROM_EMAIL=$RESEND_FROM_EMAIL
railway variables set SESSION_SECRET=$(openssl rand -hex 32)

# Generate public domain
railway domain
```
Note the generated domain URL.

### 4. `src/utils/checkPersistence.js`
- Detect ephemeral vs persistent storage on startup
- Warn via logger if data may be lost

## Steps — Verification

### 5. Create `scripts/verify-deployment.js` (ES module)
```javascript
import https from 'https';

const DOMAIN = process.argv[2];
if (!DOMAIN) { console.error('Usage: node scripts/verify-deployment.js <domain>'); process.exit(1); }

const endpoints = [
  { path: '/api/health', name: 'Health Check' },
  { path: '/', name: 'Homepage', expect: 'Quote Log' },
  { path: '/api/auth/me', name: 'Auth (expect 401)', expectStatus: 401 },
  { path: '/api/quotes', name: 'Quotes (expect 401 unauthed)', expectStatus: 401 },
  { path: '/manifest.json', name: 'PWA Manifest' },
  { path: '/sw.js', name: 'Service Worker' },
];

async function check({ path, name, expect: content, expectStatus }) {
  const expectedCode = expectStatus || 200;
  return new Promise(resolve => {
    https.get(`https://${DOMAIN}${path}`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const ok = res.statusCode === expectedCode && (!content || data.includes(content));
        console.log(`${ok ? '✅' : '❌'} ${name}: ${res.statusCode} (expected ${expectedCode})`);
        resolve(ok);
      });
    }).on('error', err => { console.log(`❌ ${name}: ${err.message}`); resolve(false); });
  });
}

const results = [];
for (const ep of endpoints) results.push(await check(ep));
const passed = results.filter(Boolean).length;
console.log(`\n📊 ${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
```

### 6. Run verification
```bash
node scripts/verify-deployment.js YOUR_DOMAIN_HERE
```

### 7. Create `DEPLOYMENT_VERIFICATION.md`
Document all results with checkboxes:

```markdown
# Deployment Verification

**Date:** [auto-fill]
**Domain:** [domain]

## Endpoints
- [ ] /api/health → 200
- [ ] / → 200, contains "Quote Log"
- [ ] /api/auth/me → 401 (unauthenticated)
- [ ] /api/auth/register → accepts POST
- [ ] /api/auth/login → accepts POST
- [ ] /api/quotes → 401 (unauthenticated, proves auth works)
- [ ] /manifest.json → 200
- [ ] /sw.js → 200

## UI Checks
- [ ] Homepage loads with styles
- [ ] Login page renders with email/password fields
- [ ] Register page renders
- [ ] 2FA code entry page renders after login
- [ ] Settings page has logs viewer (when authenticated)
- [ ] Log filters work
- [ ] No JS console errors

## Notes
[Any issues or observations]
```

## Tests — `tests/unit/deployment.test.js`
```javascript
import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('Deployment Configuration', () => {
  it('should have valid Dockerfile with health check', () => {
    const df = fs.readFileSync('Dockerfile', 'utf8');
    expect(df).toContain('FROM node:20-alpine');
    expect(df).toContain('HEALTHCHECK');
    expect(df).toContain('USER nodejs');
  });

  it('should have railway.json with health check path', () => {
    const config = JSON.parse(fs.readFileSync('railway.json', 'utf8'));
    expect(config.deploy.healthcheckPath).toBe('/api/health');
  });

  it('should have all required env vars in .env.example', () => {
    const env = fs.readFileSync('.env.example', 'utf8');
    const requiredVars = [
      'NODE_ENV', 'PORT', 'DATABASE_PATH', 'GEMINI_API_KEY',
      'PINECONE_API_KEY', 'PINECONE_INDEX_HOST',
      'RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'SESSION_SECRET'
    ];    requiredVars.forEach(v => expect(env, `Missing ${v}`).toContain(v));
  });
});
```

## Final Verification
```bash
npx vitest run
```

## Checkpoint
```bash
git add -A && git commit -m "phase-8: railway deployment, verification" && git push
```

## Final Checklist

Before reporting done, confirm ALL of these:

**Core:**
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Application starts locally
- [ ] Health check responds

**Authentication:**
- [ ] Registration creates user and sends 2FA email
- [ ] Login validates password and sends 2FA code
- [ ] 2FA verification creates session and sets cookie
- [ ] Protected routes return 401 without valid session
- [ ] Protected routes return 200 with valid session
- [ ] Logout clears session
- [ ] Passwords are bcrypt-hashed (never plaintext)
- [ ] 2FA codes are bcrypt-hashed (never plaintext)
- [ ] No passwords, codes, or session IDs appear in logs

**Logging:**
- [ ] Logs written to DB on every request
- [ ] Level filters work
- [ ] Sensitive data is redacted
- [ ] Settings page shows logs viewer
- [ ] CSV export works

**Infrastructure:**
- [ ] Docker build succeeds
- [ ] Railway deployment live
- [ ] Production health check passes
- [ ] `verify-deployment.js` all green
- [ ] DEPLOYMENT_VERIFICATION.md created

Report: "Phase 8 complete. Application deployed to [DOMAIN]. All N/N tests passing. Deployment verification passed. Quote Log is live. 🎉"
