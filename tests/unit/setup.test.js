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
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-that-is-at-least-32-characters';
    const { initTestDatabase } = await import('../../src/config/database.js');
    initTestDatabase();
    const { createApp } = await import('../../src/index.js');
    const supertest = (await import('supertest')).default;
    const { app } = createApp();
    const res = await supertest(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  }, 15000);
});
