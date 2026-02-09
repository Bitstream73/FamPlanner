import { api } from './api.js';
import { getCurrentHouseholdId } from './dashboard.js';

export async function renderHandbook(container) {
  const hId = getCurrentHouseholdId();
  if (!hId) {
    container.innerHTML = '<div class="alert alert-error">Select a household first. <a href="#/dashboard">Go to Dashboard</a></div>';
    return;
  }

  container.innerHTML = '<p>Loading handbook...</p>';

  try {
    const { data: entries, total } = await api.get(`/v1/${hId}/handbook`);

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h2>Household Handbook</h2>
        <button class="btn btn-primary" id="add-entry-btn">Add Entry</button>
      </div>

      <div style="margin-bottom:1rem">
        <input class="form-input" id="search-handbook" placeholder="Search handbook..." style="max-width:300px">
      </div>

      <div id="entry-form" class="card hidden" style="margin-bottom:1rem">
        <form id="create-entry-form">
          <div class="form-group">
            <label>Type</label>
            <select class="form-input" name="entryType" id="entry-type-select">
              <option value="note">Note</option>
              <option value="howto">How-To</option>
            </select>
          </div>
          <div class="form-group">
            <label>Title</label>
            <input class="form-input" name="title" maxlength="200" required>
          </div>
          <div class="form-group">
            <label>Content</label>
            <textarea class="form-input" name="content" rows="3"></textarea>
          </div>
          <div id="steps-area" class="hidden form-group">
            <label>Steps (one per line)</label>
            <textarea class="form-input" name="steps" rows="4" placeholder="Step 1&#10;Step 2&#10;Step 3"></textarea>
          </div>
          <div class="form-group">
            <label><input type="checkbox" name="isPinned"> Pin this entry</label>
          </div>
          <button type="submit" class="btn btn-primary">Create</button>
          <button type="button" class="btn btn-outline" id="cancel-entry">Cancel</button>
        </form>
      </div>

      <div id="alert-area"></div>
      <div id="entries-list">
        ${entries.length === 0
          ? '<div class="card"><p style="color:var(--text-muted)">No handbook entries yet.</p></div>'
          : entries.map(renderEntryCard).join('')}
      </div>
    `;

    container.querySelector('#add-entry-btn').addEventListener('click', () => {
      container.querySelector('#entry-form').classList.toggle('hidden');
    });
    container.querySelector('#cancel-entry')?.addEventListener('click', () => {
      container.querySelector('#entry-form').classList.add('hidden');
    });

    container.querySelector('#entry-type-select').addEventListener('change', (e) => {
      container.querySelector('#steps-area').classList.toggle('hidden', e.target.value !== 'howto');
    });

    container.querySelector('#create-entry-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = {
        title: fd.get('title'),
        content: fd.get('content') || undefined,
        entryType: fd.get('entryType'),
        isPinned: fd.get('isPinned') === 'on',
      };
      if (fd.get('entryType') === 'howto' && fd.get('steps')) {
        body.steps = fd.get('steps').split('\n').filter((s) => s.trim());
      }
      try {
        await api.post(`/v1/${hId}/handbook`, body);
        renderHandbook(container);
      } catch (err) { showAlert(container, err.message, 'error'); }
    });

    // Search
    let searchTimeout;
    container.querySelector('#search-handbook').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        const q = e.target.value.trim();
        if (!q) { renderHandbook(container); return; }
        try {
          const { data: results } = await api.get(`/v1/${hId}/handbook/search?q=${encodeURIComponent(q)}`);
          container.querySelector('#entries-list').innerHTML = results.length === 0
            ? '<div class="card"><p style="color:var(--text-muted)">No results found.</p></div>'
            : results.map(renderEntryCard).join('');
        } catch (err) { showAlert(container, err.message, 'error'); }
      }, 300);
    });

    // Delete
    container.querySelectorAll('[data-delete-entry]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this entry?')) return;
        try {
          await api.delete(`/v1/${hId}/handbook/${btn.dataset.deleteEntry}`);
          renderHandbook(container);
        } catch (err) { showAlert(container, err.message, 'error'); }
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

function renderEntryCard(entry) {
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div>
          ${entry.is_pinned ? '<span class="badge badge-warn" style="margin-right:0.5rem">Pinned</span>' : ''}
          <span class="badge badge-info" style="margin-right:0.5rem">${escapeHtml(entry.entry_type)}</span>
          <strong>${escapeHtml(entry.title)}</strong>
          ${entry.content ? `<p style="margin-top:0.25rem;font-size:0.9rem">${escapeHtml(entry.content)}</p>` : ''}
          ${entry.steps ? `
            <ol style="margin-top:0.5rem;padding-left:1.25rem;font-size:0.85rem">
              ${entry.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
            </ol>
          ` : ''}
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem">
            by ${escapeHtml(entry.author_name || 'Unknown')}
          </div>
        </div>
        <button class="btn btn-sm btn-danger" data-delete-entry="${entry.id}">Del</button>
      </div>
    </div>
  `;
}

function showAlert(container, message, type) {
  const area = container.querySelector('#alert-area');
  if (area) {
    area.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
    setTimeout(() => { area.innerHTML = ''; }, 3000);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
