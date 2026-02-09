import { api } from './api.js';
import { getCurrentHouseholdId } from './dashboard.js';

export async function renderCalendar(container) {
  const hId = getCurrentHouseholdId();
  if (!hId) {
    container.innerHTML = '<div class="alert alert-error">Select a household first. <a href="#/dashboard">Go to Dashboard</a></div>';
    return;
  }

  container.innerHTML = '<p>Loading calendar...</p>';

  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const { data: events } = await api.get(`/v1/${hId}/events/month/${year}/${month}`);

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h2>Calendar - ${now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <button class="btn btn-primary" id="add-event-btn">Add Event</button>
      </div>

      <div id="event-form" class="card hidden" style="margin-bottom:1rem">
        <form id="create-event-form">
          <div class="form-group">
            <label>Title</label>
            <input class="form-input" name="title" maxlength="200" required>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
            <div class="form-group">
              <label>Start</label>
              <input class="form-input" name="startTime" type="datetime-local" required>
            </div>
            <div class="form-group">
              <label>End</label>
              <input class="form-input" name="endTime" type="datetime-local" required>
            </div>
          </div>
          <div class="form-group">
            <label>Location</label>
            <input class="form-input" name="location" placeholder="Optional">
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea class="form-input" name="description" rows="2" placeholder="Optional"></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Create Event</button>
          <button type="button" class="btn btn-outline" id="cancel-event">Cancel</button>
        </form>
      </div>

      <div id="alert-area"></div>

      ${events.length === 0
        ? '<div class="card"><p style="color:var(--text-muted)">No events this month.</p></div>'
        : renderEventsList(events)}
    `;

    container.querySelector('#add-event-btn').addEventListener('click', () => {
      container.querySelector('#event-form').classList.toggle('hidden');
    });
    container.querySelector('#cancel-event')?.addEventListener('click', () => {
      container.querySelector('#event-form').classList.add('hidden');
    });

    container.querySelector('#create-event-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api.post(`/v1/${hId}/events`, {
          title: fd.get('title'),
          startTime: Math.floor(new Date(fd.get('startTime')).getTime() / 1000),
          endTime: Math.floor(new Date(fd.get('endTime')).getTime() / 1000),
          location: fd.get('location') || undefined,
          description: fd.get('description') || undefined,
        });
        renderCalendar(container);
      } catch (err) {
        showAlert(container, err.message, 'error');
      }
    });

    // Delete handlers
    container.querySelectorAll('[data-delete-event]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this event?')) return;
        try {
          await api.delete(`/v1/${hId}/events/${btn.dataset.deleteEvent}`);
          renderCalendar(container);
        } catch (err) {
          showAlert(container, err.message, 'error');
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

function renderEventsList(events) {
  // Group by date
  const grouped = {};
  events.forEach((ev) => {
    const date = new Date(ev.start_time * 1000).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(ev);
  });

  return Object.entries(grouped).map(([date, evts]) => `
    <h3 style="margin:1rem 0 0.5rem;font-size:0.9rem;color:var(--text-muted)">${date}</h3>
    ${evts.map((ev) => `
      <div class="card" style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <strong>${escapeHtml(ev.title)}</strong>
          <div style="font-size:0.8rem;color:var(--text-muted)">
            ${formatTime(ev.start_time)} - ${formatTime(ev.end_time)}
            ${ev.location ? ` &bull; ${escapeHtml(ev.location)}` : ''}
          </div>
          ${ev.description ? `<div style="font-size:0.85rem;margin-top:0.25rem">${escapeHtml(ev.description)}</div>` : ''}
        </div>
        <button class="btn btn-sm btn-danger" data-delete-event="${ev.id}">Del</button>
      </div>
    `).join('')}
  `).join('');
}

function formatTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
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
