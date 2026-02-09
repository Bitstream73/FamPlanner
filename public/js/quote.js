import { api } from './api.js';

export async function renderQuote(container, id) {
  container.innerHTML = '<p>Loading...</p>';

  try {
    const quote = await api.get(`/quotes/${id}`);
    container.innerHTML = `
      <a href="#/" style="color:var(--primary);text-decoration:none;font-size:0.875rem">&larr; Back to quotes</a>
      <div class="card" style="margin-top:1rem">
        <p class="quote-text" style="font-size:1.25rem">"${escapeHtml(quote.text)}"</p>
        <p class="quote-author" style="margin-top:0.5rem">- ${escapeHtml(quote.author)}</p>
        ${quote.source_url ? `<p style="margin-top:0.5rem;font-size:0.875rem"><a href="${escapeHtml(quote.source_url)}" target="_blank" rel="noopener">Source</a></p>` : ''}
        ${quote.sources && quote.sources.length > 0 ? `
          <div style="margin-top:1rem">
            <h4 style="font-size:0.875rem;margin-bottom:0.5rem">Sources</h4>
            ${quote.sources.map((s) => `
              <p style="font-size:0.8rem;color:var(--text-muted)">
                ${s.source_name || ''} ${s.source_url ? `- <a href="${escapeHtml(s.source_url)}" target="_blank" rel="noopener">${escapeHtml(s.source_url)}</a>` : ''}
              </p>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
