import { api } from './api.js';
import { getCurrentHouseholdId } from './dashboard.js';

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed
let events = [];
let showingEventId = null;

const EVENT_COLORS = ['teal', 'coral', 'blue', 'amber'];

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function renderCalendar(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Calendar</h1>
      <div class="page-header-actions">
        <div class="calendar-nav">
          <button class="btn-icon" id="calendar-prev-month" aria-label="Previous month">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 4L6 10l6 6"/>
            </svg>
          </button>
          <span class="calendar-month-label" id="calendar-month-label"></span>
          <button class="btn-icon" id="calendar-next-month" aria-label="Next month">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 4l6 6-6 6"/>
            </svg>
          </button>
        </div>
        <button class="btn-primary" id="add-event-btn">Add Event</button>
      </div>
    </div>

    <div class="card" id="event-form-card" style="display: none; margin-bottom: 2rem;">
      <form id="event-form">
        <div class="form-row">
          <div class="form-group">
            <label for="event-title">Title</label>
            <input type="text" id="event-title" name="title" required />
          </div>
          <div class="form-group">
            <label for="event-location">Location</label>
            <input type="text" id="event-location" name="location" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="event-start">Start</label>
            <input type="datetime-local" id="event-start" name="startTime" required />
          </div>
          <div class="form-group">
            <label for="event-end">End</label>
            <input type="datetime-local" id="event-end" name="endTime" required />
          </div>
        </div>
        <div class="form-group">
          <label for="event-description">Description</label>
          <textarea id="event-description" name="description" rows="3"></textarea>
        </div>
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button type="button" class="btn-ghost" id="cancel-event-btn">Cancel</button>
          <button type="submit" class="btn-primary">Create Event</button>
        </div>
      </form>
    </div>

    <div id="event-detail-card"></div>

    <div class="calendar-grid" id="calendar-grid"></div>
  `;

  attachEventListeners();
  loadAndRenderMonth();
}

function attachEventListeners() {
  document.getElementById('calendar-prev-month').addEventListener('click', () => {
    currentMonth -= 1;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear -= 1;
    }
    loadAndRenderMonth();
  });

  document.getElementById('calendar-next-month').addEventListener('click', () => {
    currentMonth += 1;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear += 1;
    }
    loadAndRenderMonth();
  });

  document.getElementById('add-event-btn').addEventListener('click', () => {
    const formCard = document.getElementById('event-form-card');
    formCard.style.display = formCard.style.display === 'none' ? 'block' : 'none';
    if (formCard.style.display === 'block') {
      document.getElementById('event-title').focus();
    }
  });

  document.getElementById('cancel-event-btn').addEventListener('click', () => {
    document.getElementById('event-form-card').style.display = 'none';
    document.getElementById('event-form').reset();
  });

  document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await createEvent();
  });
}

async function loadAndRenderMonth() {
  const householdId = getCurrentHouseholdId();
  if (!householdId) {
    renderMonthView();
    return;
  }

  try {
    const monthIndex = currentMonth + 1; // Convert to 1-indexed
    const response = await api.get(`/v1/${householdId}/events/month/${currentYear}/${monthIndex}`);
    events = response.data || response.events || [];
    renderMonthView();
  } catch (err) {
    console.error('Failed to load events:', err);
    events = [];
    renderMonthView();
  }
}

function renderMonthView() {
  const monthLabel = document.getElementById('calendar-month-label');
  monthLabel.textContent = new Date(currentYear, currentMonth).toLocaleString('default', {
    month: 'long',
    year: 'numeric'
  });

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  // Render day headers
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  dayNames.forEach(day => {
    const cell = document.createElement('div');
    cell.className = 'calendar-header-cell';
    cell.textContent = day;
    grid.appendChild(cell);
  });

  // Build calendar grid
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;
  const todayDate = today.getDate();

  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const cell = createDayCell(day, currentYear, currentMonth - 1, true);
    grid.appendChild(cell);
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = isCurrentMonth && day === todayDate;
    const cell = createDayCell(day, currentYear, currentMonth, false, isToday);
    grid.appendChild(cell);
  }

  // Next month padding
  const totalCells = firstDay + daysInMonth;
  const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let day = 1; day <= remainingCells; day++) {
    const cell = createDayCell(day, currentYear, currentMonth + 1, true);
    grid.appendChild(cell);
  }
}

function createDayCell(day, year, month, isOtherMonth, isToday = false) {
  const cell = document.createElement('div');
  cell.className = 'calendar-cell';
  if (isOtherMonth) {
    cell.classList.add('other-month');
  }
  if (isToday) {
    cell.classList.add('today');
  }

  const dateNumber = document.createElement('div');
  dateNumber.className = 'calendar-date';
  dateNumber.textContent = day;
  cell.appendChild(dateNumber);

  // Add events for this day
  const cellDate = new Date(year, month, day);
  const dayEvents = getEventsForDay(cellDate);

  dayEvents.forEach((event, index) => {
    const eventEl = document.createElement('div');
    const colorClass = EVENT_COLORS[index % EVENT_COLORS.length];
    eventEl.className = `calendar-event ${colorClass}`;
    eventEl.textContent = escapeHtml(event.title);
    eventEl.dataset.eventId = event.id;
    eventEl.addEventListener('click', (e) => {
      e.stopPropagation();
      showEventDetail(event);
    });
    cell.appendChild(eventEl);
  });

  return cell;
}

function getEventsForDay(date) {
  const dateStr = date.toISOString().split('T')[0];
  return events.filter(event => {
    const eventDate = new Date(event.startTime).toISOString().split('T')[0];
    return eventDate === dateStr;
  });
}

function showEventDetail(event) {
  showingEventId = event.id;
  const detailCard = document.getElementById('event-detail-card');

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);

  detailCard.innerHTML = `
    <div class="card" style="margin-bottom: 2rem;">
      <h3 style="margin-top: 0;">${escapeHtml(event.title)}</h3>
      <p style="color: var(--warm-text-secondary); margin: 0.5rem 0;">
        ${startDate.toLocaleString('default', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })} - ${endDate.toLocaleString('default', {
          hour: 'numeric',
          minute: '2-digit'
        })}
      </p>
      ${event.location ? `<p style="margin: 0.5rem 0;"><strong>Location:</strong> ${escapeHtml(event.location)}</p>` : ''}
      ${event.description ? `<p style="margin: 0.5rem 0;">${escapeHtml(event.description)}</p>` : ''}
      <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
        <button class="btn-ghost" id="close-detail-btn">Close</button>
        <button class="btn-danger" id="delete-event-btn">Delete Event</button>
      </div>
    </div>
  `;

  document.getElementById('close-detail-btn').addEventListener('click', () => {
    detailCard.innerHTML = '';
    showingEventId = null;
  });

  document.getElementById('delete-event-btn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete this event?')) {
      await deleteEvent(event.id);
    }
  });
}

async function createEvent() {
  const householdId = getCurrentHouseholdId();
  if (!householdId) {
    alert('Please select a household first');
    return;
  }

  const form = document.getElementById('event-form');
  const formData = new FormData(form);

  const eventData = {
    title: formData.get('title'),
    startTime: new Date(formData.get('startTime')).toISOString(),
    endTime: new Date(formData.get('endTime')).toISOString(),
    location: formData.get('location') || null,
    description: formData.get('description') || null
  };

  try {
    await api.post(`/v1/${householdId}/events`, eventData);

    form.reset();
    document.getElementById('event-form-card').style.display = 'none';
    await loadAndRenderMonth();
  } catch (err) {
    console.error('Failed to create event:', err);
    alert('Failed to create event. Please try again.');
  }
}

async function deleteEvent(eventId) {
  const householdId = getCurrentHouseholdId();
  if (!householdId) return;

  try {
    await api.delete(`/v1/${householdId}/events/${eventId}`);

    document.getElementById('event-detail-card').innerHTML = '';
    showingEventId = null;
    await loadAndRenderMonth();
  } catch (err) {
    console.error('Failed to delete event:', err);
    alert('Failed to delete event. Please try again.');
  }
}
