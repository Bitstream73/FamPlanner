import { api } from './api.js';

export async function renderAuthors(container) {
  container.innerHTML = '<p>Loading authors...</p>';

  try {
    const data = await api.get('/authors');
    if (data.authors.length === 0) {
      container.innerHTML = `
        <h2>Authors</h2>
        <div class="card"><p style="color:var(--text-muted)">No authors yet.</p></div>
      `;
      return;
    }

    container.innerHTML = `
      <h2>Authors</h2>
      <div id="authors-list">
        ${data.authors.map((a) => `
          <div class="card" style="cursor:pointer" data-id="${a.id}">
            <h3>${escapeHtml(a.name)}</h3>
            <p style="font-size:0.875rem;color:var(--text-muted)">${a.quoteCount} quote${a.quoteCount !== 1 ? 's' : ''}</p>
          </div>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('[data-id]').forEach((el) => {
      el.addEventListener('click', () => {
        window.location.hash = `#/authors/${el.dataset.id}`;
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

export async function renderAuthorDetail(container, id) {
  container.innerHTML = '<p>Loading...</p>';

  try {
    const author = await api.get(`/authors/${id}`);
    container.innerHTML = `
      <a href="#/authors" style="color:var(--primary);text-decoration:none;font-size:0.875rem">&larr; Back to authors</a>
      <div class="card" style="margin-top:1rem">
        <h2>${escapeHtml(author.name)}</h2>
        ${author.bio ? `<p style="color:var(--text-muted);margin-top:0.5rem">${escapeHtml(author.bio)}</p>` : ''}
      </div>
      <h3 style="margin-top:1rem">Quotes</h3>
      ${author.quotes.length > 0 ? author.quotes.map((q) => `
        <div class="card" style="cursor:pointer" data-qid="${q.id}">
          <p class="quote-text">"${escapeHtml(q.text)}"</p>
        </div>
      `).join('') : '<p style="color:var(--text-muted)">No quotes found.</p>'}
    `;

    container.querySelectorAll('[data-qid]').forEach((el) => {
      el.addEventListener('click', () => {
        window.location.hash = `#/quotes/${el.dataset.qid}`;
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
