import { api } from './api.js';

const STORAGE_KEY = 'selectedHouseholdId';

let currentHouseholdId = null;

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Get current household ID
 */
export function getCurrentHouseholdId() {
  return currentHouseholdId;
}

/**
 * Set current household ID and persist to localStorage
 */
export function setCurrentHouseholdId(id) {
  currentHouseholdId = id;
  if (id) {
    localStorage.setItem(STORAGE_KEY, id);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Load household ID from localStorage
 */
function loadStoredHouseholdId() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    currentHouseholdId = parseInt(stored, 10);
  }
}

/**
 * Fetch all households for the current user
 */
async function fetchHouseholds() {
  try {
    const response = await api.get('/v1/households');
    return response.data || response.households || [];
  } catch (error) {
    console.error('Failed to fetch households:', error);
    return [];
  }
}

/**
 * Fetch dashboard stats for a household
 */
async function fetchDashboardStats(householdId) {
  try {
    const [todayRes, upcomingRes, overdueRes, notificationsRes] = await Promise.all([
      api.get(`/v1/${householdId}/tasks/today`).catch(() => ({ data: [] })),
      api.get(`/v1/${householdId}/tasks/upcoming?days=7`).catch(() => ({ data: [] })),
      api.get(`/v1/${householdId}/tasks/overdue`).catch(() => ({ data: [] })),
      api.get('/v1/notifications?limit=5').catch(() => ({ data: [], unreadCount: 0 }))
    ]);

    return {
      today: todayRes.data || todayRes.tasks || [],
      upcoming: upcomingRes.data || upcomingRes.tasks || [],
      overdue: overdueRes.data || overdueRes.tasks || [],
      notifications: notificationsRes.data || notificationsRes.notifications || [],
      unreadCount: notificationsRes.unreadCount || 0
    };
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    throw error;
  }
}

/**
 * Mark a task as complete
 */
async function completeTask(householdId, taskId) {
  try {
    await api.post(`/v1/${householdId}/tasks/${taskId}/complete`);
    return true;
  } catch (error) {
    console.error('Failed to complete task:', error);
    return false;
  }
}

/**
 * Render household selector dropdown
 */
function renderHouseholdSelector(households, container) {
  const selector = document.createElement('select');
  selector.className = 'household-selector';
  selector.id = 'household-select';

  if (households.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No households';
    selector.appendChild(option);
    selector.disabled = true;
  } else {
    households.forEach(household => {
      const option = document.createElement('option');
      option.value = household.id;
      option.textContent = escapeHtml(household.name);
      if (household.id === currentHouseholdId) {
        option.selected = true;
      }
      selector.appendChild(option);
    });

    selector.addEventListener('change', async (e) => {
      setCurrentHouseholdId(parseInt(e.target.value, 10));
      await renderDashboard(container);
    });
  }

  return selector;
}

/**
 * Render stats grid
 */
function renderStatsGrid(stats) {
  const grid = document.createElement('div');
  grid.className = 'stats-grid fade-in';

  const statCards = [
    {
      label: "Today's Tasks",
      value: stats.today.length,
      icon: '📋',
      colorClass: 'default'
    },
    {
      label: 'Upcoming (7 Days)',
      value: stats.upcoming.length,
      icon: '📅',
      colorClass: 'info'
    },
    {
      label: 'Overdue',
      value: stats.overdue.length,
      icon: '⚠️',
      colorClass: 'warning'
    },
    {
      label: 'Unread Alerts',
      value: stats.unreadCount,
      icon: '🔔',
      colorClass: 'accent'
    }
  ];

  statCards.forEach(stat => {
    const card = document.createElement('div');
    card.className = `stat-card ${stat.colorClass}`;
    card.innerHTML = `
      <div class="stat-icon">${stat.icon}</div>
      <div class="stat-value">${stat.value}</div>
      <div class="stat-label">${escapeHtml(stat.label)}</div>
    `;
    grid.appendChild(card);
  });

  return grid;
}

/**
 * Render a single task card
 */
function renderTaskCard(task, householdId, onComplete) {
  const card = document.createElement('div');
  card.className = 'task-card fade-in';

  const checkbox = document.createElement('button');
  checkbox.className = 'task-check';
  checkbox.setAttribute('aria-label', 'Complete task');

  const content = document.createElement('div');
  content.className = 'task-content';

  const title = document.createElement('div');
  title.className = 'task-title';
  title.textContent = escapeHtml(task.title);

  const meta = document.createElement('div');
  meta.className = 'task-meta';

  const assignee = task.assignee || task.assigned_to || 'Unassigned';
  const dueTime = task.dueTime || task.due_time || '';
  meta.textContent = `${escapeHtml(assignee)}${dueTime ? ' • ' + dueTime : ''}`;

  content.appendChild(title);
  content.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const completeBtn = document.createElement('button');
  completeBtn.className = 'btn btn-sm btn-primary';
  completeBtn.textContent = 'Complete';
  completeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    completeBtn.disabled = true;
    completeBtn.textContent = 'Completing...';
    const success = await completeTask(householdId, task.id);
    if (success) {
      card.style.opacity = '0.5';
      setTimeout(() => {
        card.remove();
        if (onComplete) onComplete();
      }, 300);
    } else {
      completeBtn.disabled = false;
      completeBtn.textContent = 'Complete';
      showError('Failed to complete task. Please try again.');
    }
  });

  actions.appendChild(completeBtn);

  card.appendChild(checkbox);
  card.appendChild(content);
  card.appendChild(actions);

  return card;
}

/**
 * Render today's tasks widget
 */
function renderTodayTasksWidget(tasks, householdId, onTaskComplete) {
  const widget = document.createElement('div');
  widget.className = 'card fade-in';

  const header = document.createElement('div');
  header.className = 'card-header';

  const title = document.createElement('h2');
  title.className = 'card-title';
  title.textContent = "Today's Tasks";

  header.appendChild(title);
  widget.appendChild(header);

  const content = document.createElement('div');
  content.className = 'card-content';

  if (tasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-icon">✅</div>
      <div class="empty-title">All caught up!</div>
      <div class="empty-text">No tasks due today</div>
    `;
    content.appendChild(empty);
  } else {
    tasks.forEach(task => {
      const taskCard = renderTaskCard(task, householdId, onTaskComplete);
      content.appendChild(taskCard);
    });
  }

  widget.appendChild(content);
  return widget;
}

/**
 * Render quick actions widget
 */
function renderQuickActionsWidget() {
  const widget = document.createElement('div');
  widget.className = 'card fade-in';

  const header = document.createElement('div');
  header.className = 'card-header';

  const title = document.createElement('h2');
  title.className = 'card-title';
  title.textContent = 'Quick Actions';

  header.appendChild(title);
  widget.appendChild(header);

  const content = document.createElement('div');
  content.className = 'card-content';

  const actions = [
    { icon: '📅', label: 'Calendar', href: '#/calendar' },
    { icon: '✅', label: 'Tasks', href: '#/tasks' },
    { icon: '🔄', label: 'Routines', href: '#/routines' },
    { icon: '📢', label: 'Announcements', href: '#/announcements' },
    { icon: '📖', label: 'Handbook', href: '#/handbook' }
  ];

  actions.forEach(action => {
    const btn = document.createElement('a');
    btn.className = 'quick-action-btn';
    btn.href = action.href;
    btn.innerHTML = `
      <span class="action-icon">${action.icon}</span>
      <span>${escapeHtml(action.label)}</span>
    `;
    content.appendChild(btn);
  });

  widget.appendChild(content);
  return widget;
}

/**
 * Show error alert
 */
function showError(message) {
  const existingAlert = document.querySelector('.alert-error');
  if (existingAlert) {
    existingAlert.remove();
  }

  const alert = document.createElement('div');
  alert.className = 'alert alert-error fade-in';
  alert.textContent = message;

  const container = document.querySelector('main') || document.body;
  container.insertBefore(alert, container.firstChild);

  setTimeout(() => {
    alert.style.opacity = '0';
    setTimeout(() => alert.remove(), 300);
  }, 5000);
}

/**
 * Render empty state when no household is selected
 */
function renderEmptyState(container) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'page-header';

  const title = document.createElement('h1');
  title.className = 'page-title';
  title.textContent = 'Dashboard';

  header.appendChild(title);
  container.appendChild(header);

  const empty = document.createElement('div');
  empty.className = 'empty-state fade-in';
  empty.innerHTML = `
    <div class="empty-icon">🏠</div>
    <div class="empty-title">No Household Selected</div>
    <div class="empty-text">Create or join a household to get started</div>
    <div style="margin-top: 1.5rem;">
      <a href="#/households" class="btn btn-primary">Manage Households</a>
    </div>
  `;
  container.appendChild(empty);
}

/**
 * Render the main dashboard
 */
export async function renderDashboard(container) {
  try {
    loadStoredHouseholdId();

    const households = await fetchHouseholds();

    if (!currentHouseholdId && households.length > 0) {
      setCurrentHouseholdId(households[0].id);
    }

    if (!currentHouseholdId) {
      renderEmptyState(container);
      return;
    }

    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'page-header';

    const headerLeft = document.createElement('div');
    const title = document.createElement('h1');
    title.className = 'page-title';
    title.textContent = 'Dashboard';
    headerLeft.appendChild(title);

    const headerRight = document.createElement('div');
    const selector = renderHouseholdSelector(households, container);
    headerRight.appendChild(selector);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);
    container.appendChild(header);

    const stats = await fetchDashboardStats(currentHouseholdId);

    const statsGrid = renderStatsGrid(stats);
    container.appendChild(statsGrid);

    const widgetGrid = document.createElement('div');
    widgetGrid.className = 'widget-grid-2';

    const refreshStats = async () => {
      try {
        const updatedStats = await fetchDashboardStats(currentHouseholdId);
        const oldStatsGrid = container.querySelector('.stats-grid');
        if (oldStatsGrid) {
          const newStatsGrid = renderStatsGrid(updatedStats);
          oldStatsGrid.replaceWith(newStatsGrid);
        }
      } catch (error) {
        console.error('Failed to refresh stats:', error);
      }
    };

    const todayWidget = renderTodayTasksWidget(stats.today, currentHouseholdId, refreshStats);
    const actionsWidget = renderQuickActionsWidget();

    widgetGrid.appendChild(todayWidget);
    widgetGrid.appendChild(actionsWidget);

    container.appendChild(widgetGrid);

  } catch (error) {
    console.error('Error rendering dashboard:', error);
    showError('Failed to load dashboard. Please refresh the page.');
  }
}
