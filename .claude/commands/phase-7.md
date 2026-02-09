# Phase 7: GitHub CI/CD Workflow

## Objective
Set up GitHub Actions for continuous integration and deployment to Railway.

## Plan First
Propose the CI/CD pipeline stages. Wait for approval.

## Steps

### 1. `.github/workflows/ci.yml`
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
        env:
          NODE_ENV: test
          GEMINI_API_KEY: test-gemini-key
          PINECONE_API_KEY: test-pinecone-key
          PINECONE_INDEX_HOST: https://test.pinecone.io

      - name: Run coverage
        run: npm run test:coverage
        env:
          NODE_ENV: test
          GEMINI_API_KEY: test-gemini-key
          PINECONE_API_KEY: test-pinecone-key
          PINECONE_INDEX_HOST: https://test.pinecone.io

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t quote-log:test .

      - name: Smoke test Docker image
        run: |
          docker run -d --name smoke \
            -e GEMINI_API_KEY=test-key \
            -e PINECONE_API_KEY=test-key \
            -e PINECONE_INDEX_HOST=https://test.pinecone.io \
            -e NODE_ENV=test \
            -p 3000:3000 \
            quote-log:test
          sleep 5
          curl -f http://localhost:3000/api/health || exit 1
          docker stop smoke
```

### 2. `.github/workflows/deploy.yml`
```yaml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: []
    steps:
      - uses: actions/checkout@v4

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Deploy
        run: railway up --service ${{ secrets.RAILWAY_SERVICE_ID }}
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

### 3. Guide user to set GitHub Secrets
Tell the user they need to add these repository secrets in GitHub → Settings → Secrets:
- `RAILWAY_TOKEN`
- `RAILWAY_SERVICE_ID`

## Tests — `tests/unit/health.test.js`
```javascript
import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';

describe('Health Check (CI verification)', () => {
  let request;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.PINECONE_API_KEY = 'test-key';
    process.env.PINECONE_INDEX_HOST = 'https://test.pinecone.io';
    const { createApp } = await import('../../src/index.js');
    request = supertest(await createApp());
  });

  it('should return healthy with version and services', async () => {
    const res = await request.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('services');
    expect(res.body.services).toHaveProperty('database');
  });
});
```

## Verification
```bash
npx vitest run
```

## Checkpoint
```bash
git add -A && git commit -m "phase-7: github ci/cd workflows" && git push
```

Report: "Phase 7 complete. CI/CD workflows committed. Tell me your RAILWAY_TOKEN and RAILWAY_SERVICE_ID to set as GitHub secrets, or set them manually. Ready for /phase-8."
