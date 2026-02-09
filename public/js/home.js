import { api } from './api.js';

export async function renderHome(container) {
  container.innerHTML = '<p>Loading quotes...</p>';

  try {
    const data = await api.get('/quotes?page=1&limit=20');
    if (data.quotes.length === 0) {
      container.innerHTML = `
        <h2>Quotes</h2>
        <div class="card"><p style="color:var(--text-muted)">No quotes yet.</p></div>
      `;
      return;
    }

    container.innerHTML = `
      <h2>Quotes</h2>
      <div id="quotes-list">
        ${data.quotes.map((q) => `
          <div class="card" style="cursor:pointer" data-id="${q.id}">
            <p class="quote-text">"${escapeHtml(q.text)}"</p>
            <p class="quote-author">- ${escapeHtml(q.author)}</p>
          </div>
        `).join('')}
      </div>
      ${renderPagination(data.page, data.totalPages)}
    `;

    container.querySelectorAll('[data-id]').forEach((el) => {
      el.addEventListener('click', () => {
        window.location.hash = `#/quotes/${el.dataset.id}`;
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function renderPagination(page, totalPages) {
  if (totalPages <= 1) return '';
  const buttons = [];
  if (page > 1) buttons.push(`<button class="btn btn-sm btn-outline" onclick="window.location.hash='#/?page=${page - 1}'">Prev</button>`);
  buttons.push(`<span style="padding:0.25rem 0.5rem">${page} / ${totalPages}</span>`);
  if (page < totalPages) buttons.push(`<button class="btn btn-sm btn-outline" onclick="window.location.hash='#/?page=${page + 1}'">Next</button>`);
  return `<div class="pagination">${buttons.join('')}</div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
