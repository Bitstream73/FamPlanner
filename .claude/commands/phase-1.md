# Phase 1: Project Initialization & GitHub Repository

## Objective
Create the project structure, install dependencies, connect to GitHub.

## Plan First
Propose your directory structure and dependency list. Wait for user approval before creating files.

## Steps

### 1. Create directory structure
```
quote-log/
├── src/
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   │   └── ai/
│   ├── jobs/
│   └── utils/
├── public/
│   ├── css/
│   └── js/
├── tests/
│   ├── unit/
│   └── integration/
├── docs/
├── scripts/
├── .github/
│   └── workflows/
├── .claude/
│   └── commands/
├── data/           (gitignored)
└── uploads/        (gitignored)
```

### 2. Initialize npm project

Use latest stable versions of all packages. Core dependencies:
- express, better-sqlite3, @pinecone-database/pinecone, socket.io
- multer, sharp, dotenv, @google/generative-ai, uuid
- helmet, cors, express-rate-limit
- resend, bcrypt, cookie-parser

Dev dependencies:
- vitest, supertest, @vitest/coverage-v8

Add to package.json scripts:
```json
{
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 3. Create configuration files

**`.gitignore`:**
```
node_modules/
.env
*.db
data/
uploads/
coverage/
.DS_Store
```

**`vitest.config.js`:**
```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['tests/**', 'vitest.config.js']
    }
  }
});
```

### 4. Create initial `src/index.js`
Minimal placeholder that exports a `createApp()` function (to be fleshed out in Phase 4):
```javascript
import express from 'express';

export function createApp() {
  const app = express();
  app.get('/api/health', (req, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() }));
  return app;
}

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  const app = createApp();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
```

### 5. Initialize GitHub repo
```bash
git init
git add -A
git commit -m "phase-1: project initialization"
gh repo create quote-log --public --source=. --remote=origin --push
```

## Tests — `tests/unit/setup.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('Project Setup', () => {
  it('should have package.json with required dependencies', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    expect(pkg.type).toBe('module');
    expect(pkg.dependencies).toHaveProperty('express');
    expect(pkg.dependencies).toHaveProperty('better-sqlite3');
    expect(pkg.dependencies).toHaveProperty('@pinecone-database/pinecone');
    expect(pkg.dependencies).toHaveProperty('socket.io');
    expect(pkg.dependencies).toHaveProperty('@google/generative-ai');
  });

  it('should have required directory structure', () => {
    const dirs = ['src', 'src/routes', 'src/services', 'src/middleware', 'src/config', 'public', 'tests', 'docs'];
    dirs.forEach(dir => expect(fs.existsSync(dir), `Missing: ${dir}`).toBe(true));
  });

  it('should have .env.example without real secrets', () => {
    const content = fs.readFileSync('.env.example', 'utf8');
    expect(content).toContain('GEMINI_API_KEY');
    expect(content).not.toMatch(/AIza[A-Za-z0-9_-]{30,}/); // no real Google keys
  });

  it('should have .gitignore excluding .env and node_modules', () => {
    const content = fs.readFileSync('.gitignore', 'utf8');
    expect(content).toContain('.env');
    expect(content).toContain('node_modules');
  });

  it('should have a health endpoint', async () => {
    const { createApp } = await import('../../src/index.js');
    const supertest = (await import('supertest')).default;
    const res = await supertest(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });
});
```

## Verification
```bash
npm install
npx vitest run
```
All tests must pass.

## Checkpoint
```bash
git add -A && git commit -m "phase-1: project init with tests" && git push
```

Report: "Phase 1 complete. N/N tests passing. Repo pushed to GitHub. Ready for /phase-2."
