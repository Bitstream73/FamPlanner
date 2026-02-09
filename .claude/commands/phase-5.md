# Phase 5: AI Service Integration (Gemini)

## Objective
Implement Gemini AI service for text generation, embeddings, and quote extraction with full logging.

## Plan First
Check the Gemini model name discovered in Phase 0. Propose your service interface. Wait for approval.

## Steps

### 1. `src/services/ai/gemini.js`
- Initialize Google Generative AI client from `@google/generative-ai`
- Use the latest stable model (confirmed in Phase 0)
- **Log every API call** per `docs/LOGGING.md`:
  - `logger.info('ai', 'gemini_request', { model, requestType, duration })`
  - `logger.info('ai', 'gemini_response', { model, tokenUsage, duration })`
  - `logger.error('ai', 'gemini_failed', { model, requestType }, errorMessage)`
- Methods:
  - `generateText(prompt, options)` — general text generation
  - `generateEmbedding(text)` — for vector DB storage
  - `extractQuotes(articleText)` — extract quotes + authors from article text, return structured JSON
  - `chat(messages)` — multi-turn conversation

### 2. `src/services/quoteExtractor.js`
- Higher-level service that uses Gemini to:
  - Accept raw article text
  - Extract quoted statements
  - Identify speakers/authors
  - Return `[{ quote, author, context }]`
- Log extraction results and timing

## Tests — `tests/unit/ai-services.test.js`

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: { text: () => 'Generated response' }
      }),
      embedContent: vi.fn().mockResolvedValue({
        embedding: { values: new Array(768).fill(0.1) }
      })
    })
  }))
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
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    GoogleGenerativeAI.mockImplementationOnce(() => ({
      getGenerativeModel: () => ({
        generateContent: vi.fn().mockRejectedValue(new Error('API limit reached'))
      })
    }));
    vi.resetModules();
    process.env.GEMINI_API_KEY = 'test-key';
    const mod = await import('../../src/services/ai/gemini.js');
    await expect(mod.default.generateText('test')).rejects.toThrow();
  });
});
```

## Verification
```bash
npx vitest run
```

## Checkpoint
```bash
git add -A && git commit -m "phase-5: gemini ai service with logging" && git push
```

Report: "Phase 5 complete. N/N tests passing. AI service operational. Ready for /phase-6."
