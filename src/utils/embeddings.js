import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../services/logger.js';

const EMBEDDING_MODEL = 'text-embedding-004';

let genAI;

function getClient() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

export async function generateEmbedding(text) {
  const start = Date.now();
  try {
    const model = getClient().getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent(text);
    const duration = Date.now() - start;

    logger.info('ai', 'embedding_generated', {
      model: EMBEDDING_MODEL,
      inputLength: text.length,
      duration,
    });

    return result.embedding.values;
  } catch (err) {
    logger.error('ai', 'embedding_failed', { model: EMBEDDING_MODEL }, err.message);
    throw err;
  }
}

export async function generateEmbeddings(texts) {
  const start = Date.now();
  try {
    const model = getClient().getGenerativeModel({ model: EMBEDDING_MODEL });
    const results = await Promise.all(
      texts.map((text) => model.embedContent(text))
    );
    const duration = Date.now() - start;

    logger.info('ai', 'batch_embeddings_generated', {
      model: EMBEDDING_MODEL,
      count: texts.length,
      duration,
    });

    return results.map((r) => r.embedding.values);
  } catch (err) {
    logger.error('ai', 'batch_embedding_failed', { model: EMBEDDING_MODEL }, err.message);
    throw err;
  }
}
