import { api } from './api.js';

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(ts) {
  if (!ts) return '';
  const now = Date.now();
  const date = typeof ts === 'number' ? ts * 1000 : new Date(ts).getTime();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function typeIcon(type) {
  const icons = {
    task: '&#x2705;',
    event: '&#x1F4C5;',
    announcement: '&#x1F4E2;',
    routine: '&#x1F504;',
    household: '&#x1F3E0;',
    system: '&#x2699;&#xFE0F;',
  };
  return icons[type] || '&#x1F514;';
}

function showAlert(container, message, type) {
  const area = container.querySelector('#alert-area');
  if (area) {
    area.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
    setTimeout(() => { area.innerHTML = ''; }, 3000);
  }
}

export async function renderNotifications(container) {
  container.innerHTML = '<div class="text-center text-muted mt-3">Loading notifications...</div>';

  try {
    const result = await api.get('/v1/notifications?limit=50');

    const notifItems = result.data.length ? result.data.map(n => `
      <div class="notification-item ${n.is_read ? '' : 'unread'} fade-in">
        <div class="notification-icon">${typeIcon(n.type)}</div>
        <div class="notification-body">
          <div class="notification-text">
            <strong>${escapeHtml(n.title)}</strong>
            ${n.body ? `<br><span style="color:var(--text-secondary)">${escapeHtml(n.body)}</span>` : ''}
          </div>
          <div class="notification-time">${timeAgo(n.created_at)}</div>
        </div>
        <div class="notification-actions">
          ${!n.is_read ? `<button class="btn btn-ghost btn-sm" data-mark-read="${n.id}" title="Mark read">&#x2713;</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-delete-notif="${n.id}" title="Delete" style="color:var(--error)">&#x1F5D1;</button>
        </div>
      </div>
    `).join('') : `
      <div class="empty-state">
        <div class="empty-icon">&#x1F514;</div>
        <div class="empty-title">All caught up!</div>
        <div class="empty-text">No notifications to show.</div>
      </div>`;

    container.innerHTML = `
      <div class="page-header fade-in">
        <div class="page-header-left">
          <h1 class="page-title">Notifications</h1>
          <p class="page-subtitle">${result.unreadCount > 0 ? `${result.unreadCount} unread` : 'All read'}</p>
        </div>
        <div class="page-header-actions">
          ${result.unreadCount > 0 ? '<button class="btn btn-outline" id="mark-all-read">Mark All Read</button>' : ''}
        </div>
      </div>

      <div id="alert-area"></div>

      <div class="card" style="padding:0;overflow:hidden">
        ${notifItems}
      </div>
    `;

    // Mark all read
    container.querySelector('#mark-all-read')?.addEventListener('click', async () => {
      try {
        await api.post('/v1/notifications/read-all', {});
        await renderNotifications(container);
      } catch (err) { showAlert(container, err.message, 'error'); }
    });

    // Mark individual read
    container.querySelectorAll('[data-mark-read]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.put(`/v1/notifications/${btn.dataset.markRead}/read`, {});
          await renderNotifications(container);
        } catch (err) { showAlert(container, err.message, 'error'); }
      });
    });

    // Delete
    container.querySelectorAll('[data-delete-notif]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.delete(`/v1/notifications/${btn.dataset.deleteNotif}`);
          await renderNotifications(container);
        } catch (err) { showAlert(container, err.message, 'error'); }
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}
