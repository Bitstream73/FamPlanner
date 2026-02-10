import { api } from './api.js';
import { getCurrentHouseholdId } from './dashboard.js';

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showAlert(container, message, type) {
  const area = container.querySelector('#alert-area');
  if (area) {
    area.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
    setTimeout(() => { area.innerHTML = ''; }, 3000);
  }
}

function renderEntryCard(entry) {
  const typeIcons = { note: '&#x1F4DD;', howto: '&#x1F527;' };
  const typeBadge = { note: 'badge-info', howto: 'badge-warning' };
  const icon = typeIcons[entry.entry_type] || '&#x1F4DD;';
  const badge = typeBadge[entry.entry_type] || 'badge-info';
  const initial = (entry.author_name || 'U').charAt(0).toUpperCase();

  return `
    <div class="handbook-entry ${entry.is_pinned ? 'pinned' : ''} fade-in">
      <div class="handbook-entry-type">
        <span class="badge ${badge}">${icon} ${escapeHtml(entry.entry_type)}</span>
        ${entry.is_pinned ? '<span class="badge badge-accent" style="margin-left:0.35rem">&#x1F4CC; Pinned</span>' : ''}
      </div>
      <div class="handbook-title">${escapeHtml(entry.title)}</div>
      ${entry.content ? `<div class="handbook-content">${escapeHtml(entry.content)}</div>` : ''}
      ${entry.steps ? `
        <ol class="handbook-steps">
          ${entry.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
        </ol>
      ` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.75rem">
        <div style="display:flex;align-items:center;gap:0.5rem">
          <div class="member-avatar" style="width:24px;height:24px;font-size:0.65rem">${initial}</div>
          <span class="text-xs text-muted">${escapeHtml(entry.author_name || 'Unknown')}</span>
        </div>
        <button class="btn btn-ghost btn-sm" data-delete-entry="${entry.id}" style="color:var(--error)">
          &#x1F5D1; Delete
        </button>
      </div>
    </div>`;
}

export async function renderHandbook(container) {
  const hId = getCurrentHouseholdId();
  if (!hId) {
    container.innerHTML = `
      <div class="empty-state fade-in">
        <div class="empty-icon">&#x1F4D6;</div>
        <div class="empty-title">No household selected</div>
        <div class="empty-text">Select a household to view the handbook.</div>
        <a href="#/dashboard" class="btn btn-primary">Go to Dashboard</a>
      </div>`;
    return;
  }

  container.innerHTML = '<div class="text-center text-muted mt-3">Loading handbook...</div>';

  try {
    const { data: entries } = await api.get(`/v1/${hId}/handbook`);

    const entryCards = entries.length ? entries.map(renderEntryCard).join('') : `
      <div class="empty-state">
        <div class="empty-icon">&#x1F4D6;</div>
        <div class="empty-title">No handbook entries yet</div>
        <div class="empty-text">Add notes, how-tos, and important info for your family.</div>
      </div>`;

    container.innerHTML = `
      <div class="page-header fade-in">
        <div class="page-header-left">
          <h1 class="page-title">Handbook</h1>
          <p class="page-subtitle">Family notes, guides, and how-tos</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="add-entry-btn">&#x2795; Add Entry</button>
        </div>
      </div>

      <div class="search-bar fade-in">
        <span class="search-icon">&#x1F50D;</span>
        <input class="form-input" id="search-handbook" placeholder="Search handbook...">
      </div>

      <div id="entry-form" class="card hidden mb-2 fade-in">
        <form id="create-entry-form">
          <div class="form-row">
            <div class="form-group">
              <label>Type</label>
              <select class="form-input" name="entryType" id="entry-type-select">
                <option value="note">&#x1F4DD; Note</option>
                <option value="howto">&#x1F527; How-To</option>
              </select>
            </div>
            <div class="form-group">
              <label>Title</label>
              <input class="form-input" name="title" maxlength="200" required placeholder="e.g. Wi-Fi password, Emergency contacts">
            </div>
          </div>
          <div class="form-group">
            <label>Content</label>
            <textarea class="form-input" name="content" rows="3" placeholder="Write your note here..."></textarea>
          </div>
          <div id="steps-area" class="hidden form-group">
            <label>Steps (one per line)</label>
            <textarea class="form-input" name="steps" rows="4" placeholder="Step 1&#10;Step 2&#10;Step 3"></textarea>
          </div>
          <label class="form-checkbox mb-2">
            <input type="checkbox" name="isPinned"> Pin this entry
          </label>
          <div style="display:flex;gap:0.5rem">
            <button type="submit" class="btn btn-primary">Create Entry</button>
            <button type="button" class="btn btn-ghost" id="cancel-entry">Cancel</button>
          </div>
        </form>
      </div>

      <div id="alert-area"></div>
      <div id="entries-list">${entryCards}</div>
    `;

    // Toggle form
    container.querySelector('#add-entry-btn').addEventListener('click', () => {
      container.querySelector('#entry-form')?.classList.toggle('hidden');
    });
    container.querySelector('#cancel-entry')?.addEventListener('click', () => {
      container.querySelector('#entry-form')?.classList.add('hidden');
    });

    // Toggle steps area for how-to type
    container.querySelector('#entry-type-select').addEventListener('change', (e) => {
      container.querySelector('#steps-area').classList.toggle('hidden', e.target.value !== 'howto');
    });

    // Create entry
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
        body.steps = fd.get('steps').split('\n').filter(s => s.trim());
      }
      try {
        await api.post(`/v1/${hId}/handbook`, body);
        await renderHandbook(container);
      } catch (err) { showAlert(container, err.message, 'error'); }
    });

    // Search
    let searchTimeout;
    container.querySelector('#search-handbook').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        const q = e.target.value.trim();
        if (!q) { await renderHandbook(container); return; }
        try {
          const { data: results } = await api.get(`/v1/${hId}/handbook/search?q=${encodeURIComponent(q)}`);
          container.querySelector('#entries-list').innerHTML = results.length === 0
            ? '<div class="empty-state"><div class="empty-icon">&#x1F50D;</div><div class="empty-title">No results</div><div class="empty-text">Try a different search term.</div></div>'
            : results.map(renderEntryCard).join('');
          bindDeleteHandlers(container, hId);
        } catch (err) { showAlert(container, err.message, 'error'); }
      }, 300);
    });

    // Delete handlers
    bindDeleteHandlers(container, hId);
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

function bindDeleteHandlers(container, hId) {
  container.querySelectorAll('[data-delete-entry]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this entry?')) return;
      try {
        await api.delete(`/v1/${hId}/handbook/${btn.dataset.deleteEntry}`);
        await renderHandbook(container);
      } catch (err) { showAlert(container, err.message, 'error'); }
    });
  });
}
