import { Pinecone } from '@pinecone-database/pinecone';
import logger from './logger.js';

const DEFAULT_NAMESPACE = 'default';

let client;
let index;

function getIndex() {
  if (!index) {
    const apiKey = process.env.PINECONE_API_KEY;
    const indexHost = process.env.PINECONE_INDEX_HOST;

    client = new Pinecone({ apiKey });
    index = client.index(indexHost);

    logger.debug('vectordb', 'connection', {
      environment: 'serverless',
      indexHost,
    });
  }
  return index;
}

async function upsertEmbeddings(vectors, namespace = DEFAULT_NAMESPACE) {
  const start = Date.now();
  try {
    const idx = getIndex();
    const result = await idx.namespace(namespace).upsert(vectors);
    const duration = Date.now() - start;

    logger.info('vectordb', 'upsert', {
      count: vectors.length,
      namespace,
      duration,
    });

    return result;
  } catch (err) {
    logger.error('vectordb', 'operation_failed', { operation: 'upsert' }, err.message);
    throw err;
  }
}

async function queryByVector(vector, topK = 5, filter = null, namespace = DEFAULT_NAMESPACE) {
  const start = Date.now();
  try {
    const idx = getIndex();
    const queryParams = { vector, topK, includeMetadata: true };
    if (filter) queryParams.filter = filter;

    const result = await idx.namespace(namespace).query(queryParams);
    const duration = Date.now() - start;

    logger.info('vectordb', 'query', {
      topK,
      namespace,
      matchCount: result.matches?.length || 0,
      duration,
    });

    return result;
  } catch (err) {
    logger.error('vectordb', 'operation_failed', { operation: 'query' }, err.message);
    throw err;
  }
}

async function deleteByIds(ids, namespace = DEFAULT_NAMESPACE) {
  const start = Date.now();
  try {
    const idx = getIndex();
    for (const id of ids) {
      await idx.namespace(namespace).deleteOne(id);
    }
    const duration = Date.now() - start;

    logger.info('vectordb', 'delete', {
      count: ids.length,
      namespace,
      duration,
    });
  } catch (err) {
    logger.error('vectordb', 'operation_failed', { operation: 'delete' }, err.message);
    throw err;
  }
}

async function getIndexStats() {
  const start = Date.now();
  try {
    const idx = getIndex();
    const stats = await idx.describeIndexStats();
    const duration = Date.now() - start;

    logger.info('vectordb', 'stats', { duration });

    return stats;
  } catch (err) {
    logger.error('vectordb', 'operation_failed', { operation: 'stats' }, err.message);
    throw err;
  }
}

export default { upsertEmbeddings, queryByVector, deleteByIds, getIndexStats };
