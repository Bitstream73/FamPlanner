import { api } from './api.js';
import { getCurrentHouseholdId } from './dashboard.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(ts) {
  const now = Date.now();
  const date = typeof ts === 'number' ? ts * 1000 : new Date(ts).getTime();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

export async function renderAnnouncements(container) {
  const hId = getCurrentHouseholdId();
  if (!hId) {
    container.innerHTML = `
      <div class="empty-state fade-in">
        <div class="empty-icon">&#x1F4E2;</div>
        <div class="empty-title">No household selected</div>
        <div class="empty-text">Select a household to view the family feed.</div>
        <a href="#/dashboard" class="btn btn-primary">Go to Dashboard</a>
      </div>`;
    return;
  }

  container.innerHTML = '<div class="text-center text-muted mt-3">Loading feed...</div>';

  try {
    const { data: announcements } = await api.get(`/v1/${hId}/announcements`);

    const feedCards = announcements.length ? announcements.map(a => {
      const initial = (a.authorName || 'U').charAt(0).toUpperCase();
      const isPinned = a.pinned ? 'pinned' : '';
      return `
        <div class="feed-card ${isPinned} fade-in">
          ${a.pinned ? '<span class="badge badge-accent" style="position:absolute;top:0.75rem;right:0.75rem">&#x1F4CC; Pinned</span>' : ''}
          <div class="feed-author">
            <div class="feed-author-avatar">${initial}</div>
            <span class="feed-author-name">${escapeHtml(a.authorName || 'Unknown')}</span>
            <span class="feed-time">${timeAgo(a.createdAt)}</span>
          </div>
          <div class="feed-content">${escapeHtml(a.content)}</div>
          <div class="feed-actions">
            <button class="btn btn-ghost btn-sm" data-pin="${a.id}" data-pinned="${a.pinned ? '1' : '0'}">
              ${a.pinned ? '&#x1F4CC; Unpin' : '&#x1F4CC; Pin'}
            </button>
            <button class="btn btn-ghost btn-sm" data-delete-ann="${a.id}" style="color:var(--error)">
              &#x1F5D1; Delete
            </button>
          </div>
        </div>`;
    }).join('') : `
      <div class="empty-state">
        <div class="empty-icon">&#x1F4E2;</div>
        <div class="empty-title">No announcements yet</div>
        <div class="empty-text">Post something to share with your family.</div>
      </div>`;

    container.innerHTML = `
      <div class="page-header fade-in">
        <div class="page-header-left">
          <h1 class="page-title">Family Feed</h1>
          <p class="page-subtitle">Announcements and updates</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="new-post-btn">&#x270F;&#xFE0F; Post</button>
        </div>
      </div>

      <div id="post-form" class="card hidden mb-2 fade-in">
        <form id="create-ann-form">
          <div class="form-group">
            <label>What's on your mind?</label>
            <textarea class="form-input" name="content" rows="3" maxlength="5000" required placeholder="Share something with the family..."></textarea>
          </div>
          <div style="display:flex;gap:0.5rem">
            <button type="submit" class="btn btn-primary">Post</button>
            <button type="button" class="btn btn-ghost" id="cancel-post">Cancel</button>
          </div>
        </form>
      </div>

      <div id="feed-list">${feedCards}</div>
    `;

    container.querySelector('#new-post-btn')?.addEventListener('click', () => {
      container.querySelector('#post-form')?.classList.toggle('hidden');
    });
    container.querySelector('#cancel-post')?.addEventListener('click', () => {
      container.querySelector('#post-form')?.classList.add('hidden');
    });

    container.querySelector('#create-ann-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = new FormData(e.target).get('content');
      await api.post(`/v1/${hId}/announcements`, { content });
      await renderAnnouncements(container);
    });

    container.querySelectorAll('[data-pin]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.pin;
        const isPinned = btn.dataset.pinned === '1';
        const action = isPinned ? 'unpin' : 'pin';
        await api.post(`/v1/${hId}/announcements/${id}/${action}`);
        await renderAnnouncements(container);
      });
    });

    container.querySelectorAll('[data-delete-ann]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this announcement?')) return;
        await api.delete(`/v1/${hId}/announcements/${btn.dataset.deleteAnn}`);
        await renderAnnouncements(container);
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}
