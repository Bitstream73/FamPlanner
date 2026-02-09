import { api } from './api.js';
import { getCurrentHouseholdId } from './dashboard.js';

export async function renderAnnouncements(container) {
  const hId = getCurrentHouseholdId();
  if (!hId) {
    container.innerHTML = '<div class="alert alert-error">Select a household first. <a href="#/dashboard">Go to Dashboard</a></div>';
    return;
  }

  container.innerHTML = '<p>Loading announcements...</p>';

  try {
    const { data: announcements, total } = await api.get(`/v1/${hId}/announcements`);

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h2>Announcements</h2>
        <button class="btn btn-primary" id="add-ann-btn">New Announcement</button>
      </div>

      <div id="ann-form" class="card hidden" style="margin-bottom:1rem">
        <form id="create-ann-form">
          <div class="form-group">
            <label>Content</label>
            <textarea class="form-input" name="content" rows="3" maxlength="5000" required placeholder="Share something with the family..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Post</button>
          <button type="button" class="btn btn-outline" id="cancel-ann">Cancel</button>
        </form>
      </div>

      <div id="alert-area"></div>

      ${announcements.length === 0
        ? '<div class="card"><p style="color:var(--text-muted)">No announcements yet.</p></div>'
        : announcements.map((a) => `
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:start">
              <div style="flex:1">
                ${a.is_pinned ? '<span class="badge badge-warn" style="margin-bottom:0.25rem">Pinned</span>' : ''}
                <p>${escapeHtml(a.content)}</p>
                <div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.5rem">
                  ${escapeHtml(a.author_name || 'Unknown')} &bull; ${formatDate(a.created_at)}
                </div>
              </div>
              <div style="display:flex;gap:0.25rem;flex-shrink:0;margin-left:0.5rem">
                <button class="btn btn-sm btn-outline" data-pin="${a.id}" title="${a.is_pinned ? 'Unpin' : 'Pin'}">${a.is_pinned ? 'Unpin' : 'Pin'}</button>
                <button class="btn btn-sm btn-danger" data-delete-ann="${a.id}">Del</button>
              </div>
            </div>
          </div>
        `).join('')}
    `;

    container.querySelector('#add-ann-btn').addEventListener('click', () => {
      container.querySelector('#ann-form').classList.toggle('hidden');
    });
    container.querySelector('#cancel-ann')?.addEventListener('click', () => {
      container.querySelector('#ann-form').classList.add('hidden');
    });

    container.querySelector('#create-ann-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = new FormData(e.target).get('content');
      try {
        await api.post(`/v1/${hId}/announcements`, { content });
        renderAnnouncements(container);
      } catch (err) {
        showAlert(container, err.message, 'error');
      }
    });

    container.querySelectorAll('[data-pin]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.pin;
        const action = btn.textContent.trim() === 'Pin' ? 'pin' : 'unpin';
        try {
          await api.post(`/v1/${hId}/announcements/${id}/${action}`, {});
          renderAnnouncements(container);
        } catch (err) { showAlert(container, err.message, 'error'); }
      });
    });

    container.querySelectorAll('[data-delete-ann]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this announcement?')) return;
        try {
          await api.delete(`/v1/${hId}/announcements/${btn.dataset.deleteAnn}`);
          renderAnnouncements(container);
        } catch (err) { showAlert(container, err.message, 'error'); }
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
