import { api } from './api.js';
import { getCurrentHouseholdId } from './dashboard.js';

let currentTab = 'today';

export async function renderTasks(container) {
  const hId = getCurrentHouseholdId();
  if (!hId) {
    container.innerHTML = '<div class="alert alert-error">Select a household first. <a href="#/dashboard">Go to Dashboard</a></div>';
    return;
  }

  container.innerHTML = '<p>Loading tasks...</p>';

  try {
    const endpoints = {
      today: `/v1/${hId}/tasks/today`,
      upcoming: `/v1/${hId}/tasks/upcoming?days=7`,
      overdue: `/v1/${hId}/tasks/overdue`,
      all: `/v1/${hId}/tasks`,
    };

    const { data: tasks } = await api.get(endpoints[currentTab]);

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h2>Tasks</h2>
        <button class="btn btn-primary" id="add-task-btn">Add Task</button>
      </div>

      <div class="filters">
        ${['today', 'upcoming', 'overdue', 'all'].map((tab) => `
          <button class="filter-btn ${currentTab === tab ? 'active' : ''}" data-tab="${tab}">${tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        `).join('')}
      </div>

      <div id="task-form" class="card hidden" style="margin-bottom:1rem">
        <form id="create-task-form">
          <div class="form-group">
            <label>Title</label>
            <input class="form-input" name="title" maxlength="200" required>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea class="form-input" name="description" rows="2" placeholder="Optional"></textarea>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
            <div class="form-group">
              <label>Due Date</label>
              <input class="form-input" name="dueDate" type="date">
            </div>
            <div class="form-group">
              <label>Difficulty</label>
              <select class="form-input" name="difficulty">
                <option value="">None</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Time Estimate (minutes)</label>
            <input class="form-input" name="timeEstimateMinutes" type="number" min="0" placeholder="Optional">
          </div>
          <button type="submit" class="btn btn-primary">Create Task</button>
          <button type="button" class="btn btn-outline" id="cancel-task">Cancel</button>
        </form>
      </div>

      <div id="alert-area"></div>

      ${tasks.length === 0
        ? '<div class="card"><p style="color:var(--text-muted)">No tasks in this view.</p></div>'
        : tasks.map((t) => renderTaskCard(t)).join('')}
    `;

    // Tab switching
    container.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentTab = btn.dataset.tab;
        renderTasks(container);
      });
    });

    // Add task toggle
    container.querySelector('#add-task-btn').addEventListener('click', () => {
      container.querySelector('#task-form').classList.toggle('hidden');
    });
    container.querySelector('#cancel-task')?.addEventListener('click', () => {
      container.querySelector('#task-form').classList.add('hidden');
    });

    // Create task
    container.querySelector('#create-task-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api.post(`/v1/${hId}/tasks`, {
          title: fd.get('title'),
          description: fd.get('description') || undefined,
          dueDate: fd.get('dueDate') ? Math.floor(new Date(fd.get('dueDate')).getTime() / 1000) : undefined,
          difficulty: fd.get('difficulty') || undefined,
          timeEstimateMinutes: fd.get('timeEstimateMinutes') ? parseInt(fd.get('timeEstimateMinutes'), 10) : undefined,
        });
        renderTasks(container);
      } catch (err) {
        showAlert(container, err.message, 'error');
      }
    });

    // Complete / Delete handlers
    container.querySelectorAll('[data-complete-task]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await api.post(`/v1/${hId}/tasks/${btn.dataset.completeTask}/complete`, {});
          renderTasks(container);
        } catch (err) {
          showAlert(container, err.message, 'error');
        }
      });
    });

    container.querySelectorAll('[data-delete-task]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this task?')) return;
        try {
          await api.delete(`/v1/${hId}/tasks/${btn.dataset.deleteTask}`);
          renderTasks(container);
        } catch (err) {
          showAlert(container, err.message, 'error');
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

function renderTaskCard(t) {
  const isComplete = t.status === 'completed';
  return `
    <div class="card" style="${isComplete ? 'opacity:0.6' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <strong style="${isComplete ? 'text-decoration:line-through' : ''}">${escapeHtml(t.title)}</strong>
          ${t.difficulty ? `<span class="badge badge-debug" style="margin-left:0.5rem">${escapeHtml(t.difficulty)}</span>` : ''}
          ${t.due_date ? `<span class="badge badge-info" style="margin-left:0.25rem">${formatDate(t.due_date)}</span>` : ''}
          ${t.time_estimate_minutes ? `<span style="font-size:0.8rem;color:var(--text-muted);margin-left:0.5rem">${t.time_estimate_minutes}min</span>` : ''}
          ${t.description ? `<div style="font-size:0.85rem;color:var(--text-muted);margin-top:0.25rem">${escapeHtml(t.description)}</div>` : ''}
        </div>
        <div style="display:flex;gap:0.25rem;flex-shrink:0">
          ${!isComplete ? `<button class="btn btn-sm btn-primary" data-complete-task="${t.id}">Done</button>` : ''}
          <button class="btn btn-sm btn-danger" data-delete-task="${t.id}">Del</button>
        </div>
      </div>
    </div>
  `;
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
