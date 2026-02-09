import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../logger.js';

const TEXT_MODEL = 'gemini-2.5-flash';
const EMBEDDING_MODEL = 'text-embedding-004';

let genAI;

function getClient() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

async function generateText(prompt, options = {}) {
  const start = Date.now();
  const model = options.model || TEXT_MODEL;

  try {
    const genModel = getClient().getGenerativeModel({ model });
    const result = await genModel.generateContent(prompt);
    const text = result.response.text();
    const duration = Date.now() - start;

    logger.info('ai', 'gemini_request', { model, requestType: 'generateText', duration });
    logger.info('ai', 'gemini_response', { model, responseLength: text.length, duration });

    return text;
  } catch (err) {
    logger.error('ai', 'gemini_failed', { model, requestType: 'generateText' }, err.message);
    throw err;
  }
}

async function generateEmbedding(text) {
  const start = Date.now();

  try {
    const model = getClient().getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent(text);
    const duration = Date.now() - start;

    logger.info('ai', 'gemini_request', {
      model: EMBEDDING_MODEL,
      requestType: 'embedding',
      inputLength: text.length,
      duration,
    });

    return result.embedding.values;
  } catch (err) {
    logger.error('ai', 'gemini_failed', { model: EMBEDDING_MODEL, requestType: 'embedding' }, err.message);
    throw err;
  }
}

async function extractQuotes(articleText) {
  const prompt = `Extract all direct quotes from the following article text. For each quote, identify the speaker/author and any surrounding context.

Return ONLY valid JSON in this exact format (no markdown, no code fences):
[{"quote": "the exact quoted text", "author": "speaker name", "context": "brief context"}]

If no quotes are found, return an empty array: []

Article text:
${articleText}`;

  const start = Date.now();

  try {
    const text = await generateText(prompt);
    const duration = Date.now() - start;

    // Parse JSON from response, handling potential markdown wrapping
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const quotes = JSON.parse(cleaned);

    logger.info('ai', 'quotes_extracted', {
      quoteCount: quotes.length,
      articleLength: articleText.length,
      duration,
    });

    return quotes;
  } catch (err) {
    logger.error('ai', 'gemini_failed', { requestType: 'extractQuotes' }, err.message);
    throw err;
  }
}

async function chat(messages) {
  const start = Date.now();
  const model = TEXT_MODEL;

  try {
    const genModel = getClient().getGenerativeModel({ model });
    const chatSession = genModel.startChat({
      history: messages.slice(0, -1).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chatSession.sendMessage(lastMessage.content);
    const text = result.response.text();
    const duration = Date.now() - start;

    logger.info('ai', 'gemini_request', { model, requestType: 'chat', messageCount: messages.length, duration });
    logger.info('ai', 'gemini_response', { model, responseLength: text.length, duration });

    return text;
  } catch (err) {
    logger.error('ai', 'gemini_failed', { model, requestType: 'chat' }, err.message);
    throw err;
  }
}

export default { generateText, generateEmbedding, extractQuotes, chat };
