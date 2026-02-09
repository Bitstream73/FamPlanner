import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGoogleGenerativeAI {
    constructor() {}
    getGenerativeModel() {
      return {
        generateContent: vi.fn().mockResolvedValue({
          response: { text: () => 'Generated response' }
        }),
        embedContent: vi.fn().mockResolvedValue({
          embedding: { values: new Array(768).fill(0.1) }
        }),
        startChat: vi.fn().mockReturnValue({
          sendMessage: vi.fn().mockResolvedValue({
            response: { text: () => 'Chat response' }
          })
        })
      };
    }
  }
}));

describe('Gemini AI Service', () => {
  let gemini;

  beforeEach(async () => {
    vi.resetModules();
    process.env.GEMINI_API_KEY = 'test-key';
    const mod = await import('../../src/services/ai/gemini.js');
    gemini = mod.default;
  });

  it('should generate text from a prompt', async () => {
    const result = await gemini.generateText('Hello');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should generate embeddings as a number array', async () => {
    const result = await gemini.generateEmbedding('Test text');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(768);
    expect(typeof result[0]).toBe('number');
  });

  it('should handle API errors without crashing', async () => {
    vi.resetModules();
    vi.doMock('@google/generative-ai', () => ({
      GoogleGenerativeAI: class FailingAI {
        constructor() {}
        getGenerativeModel() {
          return {
            generateContent: vi.fn().mockRejectedValue(new Error('API limit reached'))
          };
        }
      }
    }));
    process.env.GEMINI_API_KEY = 'test-key';
    const mod = await import('../../src/services/ai/gemini.js');
    await expect(mod.default.generateText('test')).rejects.toThrow();
  });
});
