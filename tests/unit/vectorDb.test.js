import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@pinecone-database/pinecone', () => ({
  Pinecone: class MockPinecone {
    constructor() {}
    index() {
      return {
        namespace() {
          return {
            upsert: vi.fn().mockResolvedValue({ upsertedCount: 1 }),
            query: vi.fn().mockResolvedValue({
              matches: [{ id: 'test-1', score: 0.9, metadata: { text: 'test' } }]
            }),
            deleteOne: vi.fn().mockResolvedValue({}),
          };
        },
        describeIndexStats: vi.fn().mockResolvedValue({
          dimension: 768, indexFullness: 0.1, totalRecordCount: 100
        })
      };
    }
  }
}));

describe('Vector Database Service', () => {
  let vectorDb;

  beforeEach(async () => {
    vi.resetModules();
    process.env.PINECONE_API_KEY = 'test-key';
    process.env.PINECONE_INDEX_HOST = 'https://test.pinecone.io';
    const mod = await import('../../src/services/vectorDb.js');
    vectorDb = mod.default;
  });

  it('should upsert embeddings and return count', async () => {
    const vectors = [{ id: 'v1', values: new Array(768).fill(0.1), metadata: { text: 'hello' } }];
    const result = await vectorDb.upsertEmbeddings(vectors);
    expect(result.upsertedCount).toBe(1);
  });

  it('should query vectors by similarity', async () => {
    const results = await vectorDb.queryByVector(new Array(768).fill(0.1), 5);
    expect(results.matches).toHaveLength(1);
    expect(results.matches[0].score).toBeGreaterThan(0);
  });

  it('should return index statistics', async () => {
    const stats = await vectorDb.getIndexStats();
    expect(stats).toHaveProperty('dimension');
    expect(stats).toHaveProperty('totalRecordCount');
  });
});
