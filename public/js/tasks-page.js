import { api } from './api.js';
import { getCurrentHouseholdId } from './dashboard.js';

let currentTab = 'today';

export async function renderTasks(container) {
  const householdId = getCurrentHouseholdId();
  if (!householdId) {
    container.innerHTML = '<div class="alert alert-error">Please select a household first.</div>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Tasks</h1>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="new-task-btn">New Task</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn ${currentTab === 'today' ? 'active' : ''}" data-tab="today">Today</button>
      <button class="tab-btn ${currentTab === 'upcoming' ? 'active' : ''}" data-tab="upcoming">Upcoming</button>
      <button class="tab-btn ${currentTab === 'overdue' ? 'active' : ''}" data-tab="overdue">Overdue</button>
      <button class="tab-btn ${currentTab === 'all' ? 'active' : ''}" data-tab="all">All</button>
    </div>

    <div class="card hidden" id="task-form-card">
      <form id="task-form">
        <div class="form-group">
          <label class="form-label">Title *</label>
          <input type="text" class="form-input" id="task-title" required placeholder="Task title">
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-textarea" id="task-description" placeholder="Task description"></textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input type="datetime-local" class="form-input" id="task-due-date">
          </div>
          <div class="form-group">
            <label class="form-label">Difficulty</label>
            <select class="form-select" id="task-difficulty">
              <option value="">Select difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Time Estimate (minutes)</label>
            <input type="number" class="form-input" id="task-time-estimate" min="0" placeholder="30">
          </div>
          <div class="form-group"></div>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          <button type="submit" class="btn btn-primary">Create Task</button>
          <button type="button" class="btn btn-ghost" id="cancel-form-btn">Cancel</button>
        </div>
      </form>
    </div>

    <div id="tasks-container">
      <p style="color: var(--text-muted);">Loading tasks...</p>
    </div>
  `;

  const newTaskBtn = container.querySelector('#new-task-btn');
  const taskFormCard = container.querySelector('#task-form-card');
  const cancelFormBtn = container.querySelector('#cancel-form-btn');
  const taskForm = container.querySelector('#task-form');
  const tabButtons = container.querySelectorAll('.tab-btn');

  newTaskBtn.addEventListener('click', () => {
    taskFormCard.classList.toggle('hidden');
    if (!taskFormCard.classList.contains('hidden')) {
      container.querySelector('#task-title').focus();
    }
  });

  cancelFormBtn.addEventListener('click', () => {
    taskFormCard.classList.add('hidden');
    taskForm.reset();
  });

  taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleCreateTask(householdId, taskForm, taskFormCard, container);
  });

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadTasks(householdId, currentTab, container);
    });
  });

  await loadTasks(householdId, currentTab, container);
}

async function loadTasks(householdId, tab, container) {
  const tasksContainer = container.querySelector('#tasks-container');
  tasksContainer.innerHTML = '<p style="color: var(--text-muted);">Loading tasks...</p>';

  try {
    let endpoint;
    switch (tab) {
      case 'today':
        endpoint = `/v1/${householdId}/tasks/today`;
        break;
      case 'upcoming':
        endpoint = `/v1/${householdId}/tasks/upcoming?days=7`;
        break;
      case 'overdue':
        endpoint = `/v1/${householdId}/tasks/overdue`;
        break;
      case 'all':
        endpoint = `/v1/${householdId}/tasks`;
        break;
      default:
        endpoint = `/v1/${householdId}/tasks/today`;
    }

    const response = await api.get(endpoint);
    const tasks = response.data || [];

    if (tasks.length === 0) {
      tasksContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✓</div>
          <div class="empty-title">No tasks found</div>
          <div class="empty-text">You're all caught up!</div>
        </div>
      `;
      return;
    }

    tasksContainer.innerHTML = tasks.map((task) => renderTaskCard(task, householdId)).join('');

    tasksContainer.querySelectorAll('.task-check').forEach((checkBtn) => {
      checkBtn.addEventListener('click', async () => {
        const taskId = checkBtn.dataset.taskId;
        await handleCompleteTask(householdId, taskId, tab, container);
      });
    });

    tasksContainer.querySelectorAll('.task-delete-btn').forEach((deleteBtn) => {
      deleteBtn.addEventListener('click', async () => {
        const taskId = deleteBtn.dataset.taskId;
        await handleDeleteTask(householdId, taskId, tab, container);
      });
    });
  } catch (err) {
    tasksContainer.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

function renderTaskCard(task, householdId) {
  const now = Math.floor(Date.now() / 1000);
  const isOverdue = task.due_date && task.due_date < now && task.status !== 'completed';
  const isCompleted = task.status === 'completed';

  const difficultyBadge = getDifficultyBadge(task.difficulty);
  const dueDateDisplay = task.due_date ? formatDueDate(task.due_date) : '';
  const timeEstimateDisplay = task.time_estimate_minutes ? `${task.time_estimate_minutes} min` : '';

  return `
    <div class="task-card ${isCompleted ? 'completed' : ''}">
      <button class="task-check ${isCompleted ? 'checked' : ''}" data-task-id="${task.id}">
        ${isCompleted ? '✓' : ''}
      </button>
      <div class="task-content">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          ${difficultyBadge}
          ${isOverdue ? '<span class="badge badge-error">Overdue</span>' : ''}
          ${dueDateDisplay ? `<span class="badge badge-neutral">${dueDateDisplay}</span>` : ''}
          ${timeEstimateDisplay ? `<span class="badge badge-info">${timeEstimateDisplay}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn-icon btn-ghost task-delete-btn" data-task-id="${task.id}" title="Delete task">
          🗑️
        </button>
      </div>
    </div>
  `;
}

function getDifficultyBadge(difficulty) {
  if (!difficulty) return '';
  switch (difficulty.toLowerCase()) {
    case 'easy':
      return '<span class="badge badge-success">Easy</span>';
    case 'medium':
      return '<span class="badge badge-warning">Medium</span>';
    case 'hard':
      return '<span class="badge badge-error">Hard</span>';
    default:
      return `<span class="badge badge-neutral">${escapeHtml(difficulty)}</span>`;
  }
}

function formatDueDate(timestamp) {
  const date = new Date(timestamp * 1000);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) {
    return `Today ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (isTomorrow) {
    return `Tomorrow ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

async function handleCreateTask(householdId, form, formCard, container) {
  const title = form.querySelector('#task-title').value.trim();
  const description = form.querySelector('#task-description').value.trim();
  const dueDate = form.querySelector('#task-due-date').value;
  const difficulty = form.querySelector('#task-difficulty').value;
  const timeEstimate = form.querySelector('#task-time-estimate').value;

  if (!title) {
    alert('Task title is required');
    return;
  }

  const payload = {
    title,
    description: description || undefined,
    dueDate: dueDate ? Math.floor(new Date(dueDate).getTime() / 1000) : undefined,
    difficulty: difficulty || undefined,
    timeEstimateMinutes: timeEstimate ? parseInt(timeEstimate, 10) : undefined,
  };

  try {
    await api.post(`/v1/${householdId}/tasks`, payload);
    formCard.classList.add('hidden');
    form.reset();
    await loadTasks(householdId, currentTab, container);
  } catch (err) {
    alert(`Failed to create task: ${err.message}`);
  }
}

async function handleCompleteTask(householdId, taskId, tab, container) {
  try {
    await api.post(`/v1/${householdId}/tasks/${taskId}/complete`, {});
    await loadTasks(householdId, tab, container);
  } catch (err) {
    alert(`Failed to complete task: ${err.message}`);
  }
}

async function handleDeleteTask(householdId, taskId, tab, container) {
  if (!confirm('Are you sure you want to delete this task?')) {
    return;
  }

  try {
    await api.delete(`/v1/${householdId}/tasks/${taskId}`);
    await loadTasks(householdId, tab, container);
  } catch (err) {
    alert(`Failed to delete task: ${err.message}`);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
