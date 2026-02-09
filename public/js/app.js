import { api } from './api.js';
import { renderLogin, renderRegister, renderVerify2FA, logout } from './auth.js';
import { renderHome } from './home.js';
import { renderQuote } from './quote.js';
import { renderAuthors, renderAuthorDetail } from './author.js';
import { renderSettings, applyTheme } from './settings.js';
import { renderLogs } from './logs.js';
import { initSocket, disconnectSocket } from './socket.js';
import { renderDashboard } from './dashboard.js';
import { renderHouseholds, renderHouseholdDetail } from './households.js';
import { renderCalendar } from './calendar-page.js';
import { renderTasks } from './tasks-page.js';
import { renderRoutines } from './routines-page.js';
import { renderAnnouncements } from './announcements-page.js';
import { renderHandbook } from './handbook-page.js';
import { renderNotifications } from './notifications-page.js';

const pageContent = () => document.getElementById('page-content');
const nav = () => document.getElementById('nav');

let currentUser = null;

async function checkAuth() {
  try {
    const data = await api.get('/auth/me');
    currentUser = data.user;
    return true;
  } catch {
    currentUser = null;
    return false;
  }
}

function showNav(show) {
  const n = nav();
  if (show) n.classList.remove('hidden');
  else n.classList.add('hidden');
}

function setActiveLink(page) {
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.page === page);
  });
}

async function router() {
  const hash = window.location.hash || '#/';
  const container = pageContent();

  // Public routes (no auth needed)
  if (hash === '#/login') {
    showNav(false);
    renderLogin(container);
    return;
  }
  if (hash === '#/register') {
    showNav(false);
    renderRegister(container);
    return;
  }
  if (hash === '#/verify-2fa') {
    showNav(false);
    renderVerify2FA(container);
    return;
  }

  // Auth check for protected routes
  const authed = await checkAuth();
  if (!authed) {
    window.location.hash = '#/login';
    return;
  }

  showNav(true);

  // Route matching
  if (hash === '#/' || hash.startsWith('#/?')) {
    setActiveLink('home');
    await renderHome(container);
  } else if (hash.startsWith('#/quotes/')) {
    setActiveLink('home');
    const id = hash.split('/')[2];
    await renderQuote(container, id);
  } else if (hash === '#/authors') {
    setActiveLink('');
    await renderAuthors(container);
  } else if (hash.startsWith('#/authors/')) {
    setActiveLink('');
    const id = hash.split('/')[2];
    await renderAuthorDetail(container, id);
  } else if (hash === '#/settings') {
    setActiveLink('settings');
    await renderSettings(container);
  } else if (hash === '#/logs') {
    setActiveLink('logs');
    await renderLogs(container);
  } else if (hash === '#/dashboard') {
    setActiveLink('dashboard');
    await renderDashboard(container);
  } else if (hash === '#/households') {
    setActiveLink('households');
    await renderHouseholds(container);
  } else if (hash.startsWith('#/households/')) {
    setActiveLink('households');
    const id = hash.split('/')[2];
    await renderHouseholdDetail(container, id);
  } else if (hash === '#/calendar') {
    setActiveLink('calendar');
    await renderCalendar(container);
  } else if (hash === '#/tasks') {
    setActiveLink('tasks');
    await renderTasks(container);
  } else if (hash === '#/routines') {
    setActiveLink('routines');
    await renderRoutines(container);
  } else if (hash === '#/announcements') {
    setActiveLink('announcements');
    await renderAnnouncements(container);
  } else if (hash === '#/handbook') {
    setActiveLink('handbook');
    await renderHandbook(container);
  } else if (hash === '#/notifications') {
    setActiveLink('notifications');
    await renderNotifications(container);
  } else {
    container.innerHTML = '<h2>Page not found</h2>';
  }
}

// Init
window.addEventListener('hashchange', router);

document.addEventListener('DOMContentLoaded', async () => {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Logout button
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    disconnectSocket();
    await logout();
  });

  // Close modal
  document.querySelector('.modal-close')?.addEventListener('click', () => {
    document.getElementById('modal-overlay')?.classList.add('hidden');
  });
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });

  // Load settings for theme
  try {
    const settings = await api.get('/settings');
    if (settings.theme) applyTheme(settings.theme);
  } catch {
    // Not authenticated yet, ignore
  }

  // Init socket for real-time updates
  initSocket((type, data) => {
    if (window.location.hash === '#/' || window.location.hash === '') {
      router();
    }
  });

  router();
});
