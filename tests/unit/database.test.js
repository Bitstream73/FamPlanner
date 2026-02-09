import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

describe('Database Setup', () => {
  let db;
  const testDbPath = path.join(import.meta.dirname, '../test-phase2.db');

  beforeAll(() => {
    db = new Database(testDbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  });
  afterAll(() => { db.close(); if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath); });

  it('should create quotes table with required columns', () => {
    db.exec(`CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, author TEXT NOT NULL,
      source_url TEXT, source_name TEXT, published_date INTEGER, created_at INTEGER DEFAULT (unixepoch())
    )`);
    const cols = db.prepare("PRAGMA table_info(quotes)").all().map(c => c.name);
    expect(cols).toEqual(expect.arrayContaining(['id', 'text', 'author', 'source_url']));
  });

  it('should create application_logs table with required columns', () => {
    db.exec(`CREATE TABLE IF NOT EXISTS application_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL,
      level TEXT NOT NULL CHECK(level IN ('error','warn','info','debug')),
      category TEXT NOT NULL, action TEXT NOT NULL, request_id TEXT, ip_address TEXT,
      details TEXT, duration INTEGER, error TEXT, created_at INTEGER DEFAULT (unixepoch())
    )`);
    const cols = db.prepare("PRAGMA table_info(application_logs)").all().map(c => c.name);
    expect(cols).toEqual(expect.arrayContaining(['timestamp', 'level', 'category', 'action', 'request_id']));
  });

  it('should support WAL mode', () => {
    expect(db.pragma('journal_mode')[0].journal_mode).toBe('wal');
  });
});
