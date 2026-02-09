import { api } from './api.js';

export async function renderNotifications(container) {
  container.innerHTML = '<p>Loading notifications...</p>';

  try {
    const result = await api.get('/v1/notifications?limit=50');

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h2>Notifications ${result.unreadCount > 0 ? `<span class="badge badge-error">${result.unreadCount}</span>` : ''}</h2>
        ${result.unreadCount > 0 ? '<button class="btn btn-outline btn-sm" id="mark-all-read">Mark All Read</button>' : ''}
      </div>

      <div id="alert-area"></div>

      ${result.data.length === 0
        ? '<div class="card"><p style="color:var(--text-muted)">No notifications.</p></div>'
        : result.data.map((n) => `
          <div class="card" style="${n.is_read ? 'opacity:0.6' : 'border-left:3px solid var(--primary)'}">
            <div style="display:flex;justify-content:space-between;align-items:start">
              <div>
                <strong>${escapeHtml(n.title)}</strong>
                ${n.body ? `<p style="font-size:0.85rem;margin-top:0.25rem">${escapeHtml(n.body)}</p>` : ''}
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.25rem">
                  ${escapeHtml(n.type || '')} &bull; ${formatDate(n.created_at)}
                </div>
              </div>
              <div style="display:flex;gap:0.25rem;flex-shrink:0">
                ${!n.is_read ? `<button class="btn btn-sm btn-outline" data-mark-read="${n.id}">Read</button>` : ''}
                <button class="btn btn-sm btn-danger" data-delete-notif="${n.id}">Del</button>
              </div>
            </div>
          </div>
        `).join('')}
    `;

    container.querySelector('#mark-all-read')?.addEventListener('click', async () => {
      try {
        await api.post('/v1/notifications/read-all', {});
        renderNotifications(container);
      } catch (err) { showAlert(container, err.message, 'error'); }
    });

    container.querySelectorAll('[data-mark-read]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api.put(`/v1/notifications/${btn.dataset.markRead}/read`, {});
          renderNotifications(container);
        } catch (err) { showAlert(container, err.message, 'error'); }
      });
    });

    container.querySelectorAll('[data-delete-notif]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api.delete(`/v1/notifications/${btn.dataset.deleteNotif}`);
          renderNotifications(container);
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
