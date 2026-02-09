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
      'RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'SESSION_SECRET',
    ];
    requiredVars.forEach((v) => expect(env, `Missing ${v}`).toContain(v));
  });
});
