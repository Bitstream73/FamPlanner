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
const sidebar = () => document.getElementById('sidebar');
const mobileNav = () => document.getElementById('mobile-nav');
const menuToggle = () => document.getElementById('mobile-menu-toggle');

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

function updateUserDisplay() {
  if (!currentUser) return;
  const avatarEl = document.getElementById('user-avatar');
  const nameEl = document.getElementById('user-display-name');
  if (avatarEl && currentUser.displayName) {
    avatarEl.textContent = currentUser.displayName.charAt(0).toUpperCase();
  }
  if (nameEl && currentUser.displayName) {
    nameEl.textContent = currentUser.displayName;
  }
}

function showNav(show) {
  const s = sidebar();
  const m = mobileNav();
  const t = menuToggle();
  if (show) {
    s?.classList.remove('hidden');
    m?.classList.remove('hidden');
    t?.classList.remove('hidden');
    document.querySelector('.main-content')?.style.removeProperty('margin-left');
  } else {
    s?.classList.add('hidden');
    m?.classList.add('hidden');
    t?.classList.add('hidden');
    // When nav hidden (auth pages), main content takes full width
    const mc = document.querySelector('.main-content');
    if (mc) mc.style.marginLeft = '0';
  }
}

function setActiveLink(page) {
  // Sidebar links
  document.querySelectorAll('.nav-item').forEach((link) => {
    link.classList.toggle('active', link.dataset.page === page);
  });
  // Mobile bottom nav
  document.querySelectorAll('.mobile-nav-item').forEach((link) => {
    link.classList.toggle('active', link.dataset.page === page);
  });
}

function closeMobileSidebar() {
  sidebar()?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
}

async function router() {
  const hash = window.location.hash || '#/';
  const container = pageContent();

  closeMobileSidebar();

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
  updateUserDisplay();

  // Route matching
  if (hash === '#/' || hash.startsWith('#/?')) {
    setActiveLink('dashboard');
    await renderDashboard(container);
  } else if (hash.startsWith('#/quotes/')) {
    setActiveLink('');
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
    setActiveLink('');
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
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#x1F50D;</div>
        <div class="empty-title">Page not found</div>
        <div class="empty-text">The page you're looking for doesn't exist.</div>
        <a href="#/dashboard" class="btn btn-primary">Go to Dashboard</a>
      </div>`;
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

  // Mobile menu toggle
  document.getElementById('mobile-menu-toggle')?.addEventListener('click', () => {
    const s = sidebar();
    const overlay = document.getElementById('sidebar-overlay');
    s?.classList.toggle('open');
    overlay?.classList.toggle('active');
  });

  // Close sidebar on overlay click
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeMobileSidebar);

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
    if (window.location.hash === '#/dashboard' || window.location.hash === '#/' || window.location.hash === '') {
      router();
    }
  });

  router();
});
