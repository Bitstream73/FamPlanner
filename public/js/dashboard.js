import { api } from './api.js';

let currentHouseholdId = null;

export function getCurrentHouseholdId() {
  return currentHouseholdId;
}

export function setCurrentHouseholdId(id) {
  currentHouseholdId = id;
  if (id) localStorage.setItem('currentHouseholdId', id);
}

export async function renderDashboard(container) {
  container.innerHTML = '<p>Loading dashboard...</p>';

  try {
    const { data: households } = await api.get('/v1/households');

    if (households.length === 0) {
      container.innerHTML = `
        <h2>Welcome to FamPlanner</h2>
        <div class="card">
          <p style="color:var(--text-muted);margin-bottom:1rem">Create a household to get started.</p>
          <button class="btn btn-primary" id="create-household-btn">Create Household</button>
        </div>
      `;
      container.querySelector('#create-household-btn').addEventListener('click', () => {
        window.location.hash = '#/households';
      });
      return;
    }

    // Restore or default to first household
    const savedId = parseInt(localStorage.getItem('currentHouseholdId'), 10);
    currentHouseholdId = households.find((h) => h.id === savedId) ? savedId : households[0].id;
    setCurrentHouseholdId(currentHouseholdId);

    const hId = currentHouseholdId;

    // Fetch data in parallel
    const [todayTasks, upcomingTasks, overdueTasks, notifications] = await Promise.all([
      api.get(`/v1/${hId}/tasks/today`).catch(() => ({ data: [] })),
      api.get(`/v1/${hId}/tasks/upcoming?days=7`).catch(() => ({ data: [] })),
      api.get(`/v1/${hId}/tasks/overdue`).catch(() => ({ data: [] })),
      api.get('/v1/notifications?limit=5').catch(() => ({ data: [], unreadCount: 0 })),
    ]);

    const currentHousehold = households.find((h) => h.id === currentHouseholdId);

    container.innerHTML = `
      <div class="dashboard-header">
        <h2>${escapeHtml(currentHousehold.name)}</h2>
        ${households.length > 1 ? `
          <select id="household-select" class="form-input" style="width:auto;display:inline-block">
            ${households.map((h) => `<option value="${h.id}" ${h.id === currentHouseholdId ? 'selected' : ''}>${escapeHtml(h.name)}</option>`).join('')}
          </select>
        ` : ''}
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${todayTasks.data.length}</div>
          <div class="stat-label">Today's Tasks</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${upcomingTasks.data.length}</div>
          <div class="stat-label">Upcoming (7 days)</div>
        </div>
        <div class="stat-card" style="${overdueTasks.data.length > 0 ? 'border-color:var(--error)' : ''}">
          <div class="stat-value" style="${overdueTasks.data.length > 0 ? 'color:var(--error)' : ''}">${overdueTasks.data.length}</div>
          <div class="stat-label">Overdue</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${notifications.unreadCount || 0}</div>
          <div class="stat-label">Unread Notifications</div>
        </div>
      </div>

      ${overdueTasks.data.length > 0 ? `
        <h3 style="margin-bottom:0.5rem;color:var(--error)">Overdue Tasks</h3>
        ${renderTaskList(overdueTasks.data)}
      ` : ''}

      <h3 style="margin-bottom:0.5rem">Today's Tasks</h3>
      ${todayTasks.data.length > 0 ? renderTaskList(todayTasks.data) : '<div class="card"><p style="color:var(--text-muted)">No tasks for today.</p></div>'}

      <div style="display:flex;gap:0.5rem;margin-top:1.5rem;flex-wrap:wrap">
        <a href="#/tasks" class="btn btn-primary">View All Tasks</a>
        <a href="#/calendar" class="btn btn-outline">Calendar</a>
        <a href="#/routines" class="btn btn-outline">Routines</a>
        <a href="#/announcements" class="btn btn-outline">Announcements</a>
      </div>
    `;

    // Household switcher
    container.querySelector('#household-select')?.addEventListener('change', (e) => {
      setCurrentHouseholdId(parseInt(e.target.value, 10));
      renderDashboard(container);
    });

    // Task click handlers
    container.querySelectorAll('[data-task-id]').forEach((el) => {
      el.addEventListener('click', () => {
        window.location.hash = `#/tasks/${el.dataset.taskId}`;
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

function renderTaskList(tasks) {
  return tasks.map((t) => `
    <div class="card task-card" data-task-id="${t.id}" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong>${escapeHtml(t.title)}</strong>
          ${t.due_date ? `<span class="badge badge-info" style="margin-left:0.5rem">${formatDate(t.due_date)}</span>` : ''}
          ${t.difficulty ? `<span class="badge badge-debug" style="margin-left:0.25rem">${escapeHtml(t.difficulty)}</span>` : ''}
        </div>
        <span class="badge ${t.status === 'completed' ? 'badge-info' : 'badge-warn'}">${escapeHtml(t.status || 'pending')}</span>
      </div>
    </div>
  `).join('');
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
