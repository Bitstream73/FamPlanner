import gemini from './ai/gemini.js';
import logger from './logger.js';

async function extractFromArticle(articleText) {
  const start = Date.now();

  try {
    const quotes = await gemini.extractQuotes(articleText);
    const duration = Date.now() - start;

    logger.info('ai', 'article_processed', {
      articleLength: articleText.length,
      quotesFound: quotes.length,
      duration,
    });

    return quotes.map((q) => ({
      quote: q.quote?.trim() || '',
      author: q.author?.trim() || 'Unknown',
      context: q.context?.trim() || '',
    }));
  } catch (err) {
    logger.error('ai', 'extraction_failed', {
      articleLength: articleText.length,
    }, err.message);
    throw err;
  }
}

export default { extractFromArticle };
