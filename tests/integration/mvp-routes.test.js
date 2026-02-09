import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import { sign } from 'cookie-signature';

// Mock Resend so we don't send real emails
vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor() {
      this.emails = {
        send: vi.fn().mockResolvedValue({ id: 'test-email' }),
      };
    }
  },
}));

describe('MVP v1 Routes', () => {
  let app, request, authCookie, userId, db;
  const SESSION_SECRET = 'test-secret-that-is-at-least-32-characters';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.PINECONE_API_KEY = 'test-key';
    process.env.PINECONE_INDEX_HOST = 'https://test.pinecone.io';
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@test.com';
    process.env.SESSION_SECRET = SESSION_SECRET;

    const { initTestDatabase } = await import('../../src/config/database.js');
    initTestDatabase();

    const { createApp } = await import('../../src/index.js');
    const result = createApp();
    app = result.app;
    request = supertest(app);

    const { default: authService } = await import('../../src/services/auth.js');
    const { default: database } = await import('../../src/config/database.js');
    db = database.db;

    const hash = await authService.hashPassword('TestP@ss1');
    db.prepare('INSERT OR IGNORE INTO users (email, password_hash, display_name, is_verified) VALUES (?, ?, ?, 1)')
      .run('mvptest@test.com', hash, 'MVP Tester');
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get('mvptest@test.com');
    userId = user.id;

    const sessionId = authService.createSession(userId);
    const signed = sign(sessionId, SESSION_SECRET);
    authCookie = `session_id=s%3A${encodeURIComponent(signed)}`;
  });

  afterAll(async () => {
    const { closeDatabase } = await import('../../src/config/database.js');
    closeDatabase();
  });

  // --- Households ---
  describe('Households', () => {
    let householdId;

    it('POST /api/v1/households should create a household', async () => {
      const res = await request.post('/api/v1/households')
        .set('Cookie', authCookie)
        .send({ name: 'Test Family' });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Test Family');
      householdId = res.body.data.id;
    });

    it('GET /api/v1/households should list households', async () => {
      const res = await request.get('/api/v1/households')
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/households/:id should get household details', async () => {
      const res = await request.get(`/api/v1/households/${householdId}`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Test Family');
    });

    it('PUT /api/v1/households/:id should update household', async () => {
      const res = await request.put(`/api/v1/households/${householdId}`)
        .set('Cookie', authCookie)
        .send({ name: 'Updated Family' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Family');
    });

    it('GET /api/v1/households/:id/members should list members', async () => {
      const res = await request.get(`/api/v1/households/${householdId}/members`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('POST /api/v1/households/:id/invite should generate invite', async () => {
      const res = await request.post(`/api/v1/households/${householdId}/invite`)
        .set('Cookie', authCookie)
        .send({ email: 'invited@test.com', role: 'teen' });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('token');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request.get('/api/v1/households');
      expect(res.status).toBe(401);
    });

    it('should reject non-member access to household', async () => {
      // Create another user not in the household
      const { default: authService } = await import('../../src/services/auth.js');
      const hash = await authService.hashPassword('TestP@ss1');
      db.prepare('INSERT OR IGNORE INTO users (email, password_hash, display_name, is_verified) VALUES (?, ?, ?, 1)')
        .run('outsider@test.com', hash, 'Outsider');
      const outsider = db.prepare('SELECT id FROM users WHERE email = ?').get('outsider@test.com');
      const outsiderSession = authService.createSession(outsider.id);
      const outsiderSigned = sign(outsiderSession, SESSION_SECRET);
      const outsiderCookie = `session_id=s%3A${encodeURIComponent(outsiderSigned)}`;

      const res = await request.get(`/api/v1/households/${householdId}`)
        .set('Cookie', outsiderCookie);
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/households should reject missing name', async () => {
      const res = await request.post('/api/v1/households')
        .set('Cookie', authCookie)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // --- Calendar Events ---
  describe('Calendar Events', () => {
    let householdId, eventId;

    beforeAll(async () => {
      const { default: householdService } = await import('../../src/services/household-service.js');
      const household = householdService.createHousehold('Calendar Family', userId);
      householdId = household.id;
    });

    it('POST /:householdId/events should create an event', async () => {
      const now = Math.floor(Date.now() / 1000);
      const res = await request.post(`/api/v1/${householdId}/events`)
        .set('Cookie', authCookie)
        .send({ title: 'Family Dinner', startTime: now, endTime: now + 3600, description: 'Weekly dinner' });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.title).toBe('Family Dinner');
      eventId = res.body.data.id;
    });

    it('GET /:householdId/events/:eventId should get event', async () => {
      const res = await request.get(`/api/v1/${householdId}/events/${eventId}`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Family Dinner');
    });

    it('PUT /:householdId/events/:eventId should update event', async () => {
      const res = await request.put(`/api/v1/${householdId}/events/${eventId}`)
        .set('Cookie', authCookie)
        .send({ title: 'Updated Dinner' });
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Dinner');
    });

    it('DELETE /:householdId/events/:eventId should delete event', async () => {
      const res = await request.delete(`/api/v1/${householdId}/events/${eventId}`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Event deleted');
    });

    it('should reject event creation without required fields', async () => {
      const res = await request.post(`/api/v1/${householdId}/events`)
        .set('Cookie', authCookie)
        .send({ title: 'No times' });
      expect(res.status).toBe(400);
    });
  });

  // --- Tasks ---
  describe('Tasks', () => {
    let householdId, taskId;

    beforeAll(async () => {
      const { default: householdService } = await import('../../src/services/household-service.js');
      const household = householdService.createHousehold('Task Family', userId);
      householdId = household.id;
    });

    it('POST /:householdId/tasks should create a task', async () => {
      const res = await request.post(`/api/v1/${householdId}/tasks`)
        .set('Cookie', authCookie)
        .send({ title: 'Do laundry', difficulty: 'easy' });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      taskId = res.body.data.id;
    });

    it('GET /:householdId/tasks should list tasks', async () => {
      const res = await request.get(`/api/v1/${householdId}/tasks`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /:householdId/tasks/today should return today tasks', async () => {
      const res = await request.get(`/api/v1/${householdId}/tasks/today`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /:householdId/tasks/:taskId/complete should complete task', async () => {
      const res = await request.post(`/api/v1/${householdId}/tasks/${taskId}/complete`)
        .set('Cookie', authCookie)
        .send({ note: 'All done!' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
    });

    it('DELETE /:householdId/tasks/:taskId should delete task', async () => {
      const res = await request.delete(`/api/v1/${householdId}/tasks/${taskId}`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
    });

    it('should reject task without title', async () => {
      const res = await request.post(`/api/v1/${householdId}/tasks`)
        .set('Cookie', authCookie)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  // --- Routines ---
  describe('Routines', () => {
    let householdId, routineId, stepId;

    beforeAll(async () => {
      const { default: householdService } = await import('../../src/services/household-service.js');
      const household = householdService.createHousehold('Routine Family', userId);
      householdId = household.id;
    });

    it('POST /:householdId/routines should create a routine', async () => {
      const res = await request.post(`/api/v1/${householdId}/routines`)
        .set('Cookie', authCookie)
        .send({ name: 'Morning Routine', routineType: 'morning' });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      routineId = res.body.data.id;
    });

    it('GET /:householdId/routines should list routines', async () => {
      const res = await request.get(`/api/v1/${householdId}/routines`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /:householdId/routines/:routineId/steps should add step', async () => {
      const res = await request.post(`/api/v1/${householdId}/routines/${routineId}/steps`)
        .set('Cookie', authCookie)
        .send({ title: 'Brush teeth' });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      stepId = res.body.data.id;
    });

    it('PUT /:householdId/routines/:routineId/steps/:stepId/complete should complete step', async () => {
      const res = await request.put(`/api/v1/${householdId}/routines/${routineId}/steps/${stepId}/complete`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.is_complete).toBe(1);
    });

    it('GET /:householdId/routines/:routineId/progress should return progress', async () => {
      const res = await request.get(`/api/v1/${householdId}/routines/${routineId}/progress`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('completed');
      expect(res.body.data).toHaveProperty('percentage');
    });

    it('DELETE /:householdId/routines/:routineId should delete routine', async () => {
      const res = await request.delete(`/api/v1/${householdId}/routines/${routineId}`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
    });
  });

  // --- Announcements ---
  describe('Announcements', () => {
    let householdId, announcementId;

    beforeAll(async () => {
      const { default: householdService } = await import('../../src/services/household-service.js');
      const household = householdService.createHousehold('Announce Family', userId);
      householdId = household.id;
    });

    it('POST /:householdId/announcements should create announcement', async () => {
      const res = await request.post(`/api/v1/${householdId}/announcements`)
        .set('Cookie', authCookie)
        .send({ content: 'Important family update!' });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      announcementId = res.body.data.id;
    });

    it('GET /:householdId/announcements should list announcements', async () => {
      const res = await request.get(`/api/v1/${householdId}/announcements`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /:householdId/announcements/:id/pin should pin announcement', async () => {
      const res = await request.post(`/api/v1/${householdId}/announcements/${announcementId}/pin`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.is_pinned).toBe(1);
    });

    it('GET /:householdId/announcements/pinned should return pinned', async () => {
      const res = await request.get(`/api/v1/${householdId}/announcements/pinned`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('DELETE /:householdId/announcements/:id should delete announcement', async () => {
      const res = await request.delete(`/api/v1/${householdId}/announcements/${announcementId}`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
    });
  });

  // --- Comments ---
  describe('Comments', () => {
    let taskId, commentId, householdId;

    beforeAll(async () => {
      const { default: householdService } = await import('../../src/services/household-service.js');
      const household = householdService.createHousehold('Comment Family', userId);
      householdId = household.id;

      const { default: taskService } = await import('../../src/services/task-service.js');
      const task = taskService.createTask(householdId, { title: 'Commentable Task', createdBy: userId });
      taskId = task.id;
    });

    it('POST /api/v1/comments should create a comment', async () => {
      const res = await request.post('/api/v1/comments')
        .set('Cookie', authCookie)
        .send({ entityType: 'task', entityId: taskId, content: 'Great job!' });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      commentId = res.body.data.id;
    });

    it('GET /api/v1/comments/:entityType/:entityId should list comments', async () => {
      const res = await request.get(`/api/v1/comments/task/${taskId}`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('PUT /api/v1/comments/:commentId should update comment', async () => {
      const res = await request.put(`/api/v1/comments/${commentId}`)
        .set('Cookie', authCookie)
        .send({ content: 'Updated comment' });
      expect(res.status).toBe(200);
    });

    it('DELETE /api/v1/comments/:commentId should delete comment', async () => {
      const res = await request.delete(`/api/v1/comments/${commentId}`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
    });

    it('should reject invalid entity type', async () => {
      const res = await request.post('/api/v1/comments')
        .set('Cookie', authCookie)
        .send({ entityType: 'invalid', entityId: 1, content: 'test' });
      expect(res.status).toBe(400);
    });
  });

  // --- Handbook ---
  describe('Handbook', () => {
    let householdId, entryId;

    beforeAll(async () => {
      const { default: householdService } = await import('../../src/services/household-service.js');
      const household = householdService.createHousehold('Handbook Family', userId);
      householdId = household.id;
    });

    it('POST /:householdId/handbook should create a note', async () => {
      const res = await request.post(`/api/v1/${householdId}/handbook`)
        .set('Cookie', authCookie)
        .send({ title: 'WiFi Password', content: 'The password is on the fridge' });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      entryId = res.body.data.id;
    });

    it('POST /:householdId/handbook should create a howto', async () => {
      const res = await request.post(`/api/v1/${householdId}/handbook`)
        .set('Cookie', authCookie)
        .send({ title: 'Laundry Guide', entryType: 'howto', content: 'How to do laundry', steps: ['Sort', 'Wash', 'Dry'] });
      expect(res.status).toBe(201);
      expect(res.body.data.entry_type).toBe('howto');
    });

    it('GET /:householdId/handbook should list entries', async () => {
      const res = await request.get(`/api/v1/${householdId}/handbook`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /:householdId/handbook/search should search entries', async () => {
      const res = await request.get(`/api/v1/${householdId}/handbook/search?q=WiFi`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /:householdId/handbook/:entryId should get entry', async () => {
      const res = await request.get(`/api/v1/${householdId}/handbook/${entryId}`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('WiFi Password');
    });

    it('DELETE /:householdId/handbook/:entryId should delete entry', async () => {
      const res = await request.delete(`/api/v1/${householdId}/handbook/${entryId}`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
    });
  });

  // --- Notifications ---
  describe('Notifications', () => {
    let notificationId, householdId;

    beforeAll(async () => {
      const { default: householdService } = await import('../../src/services/household-service.js');
      const household = householdService.createHousehold('Notify Family', userId);
      householdId = household.id;

      // Create a notification directly
      const { default: notificationService } = await import('../../src/services/notification-service.js');
      const notification = notificationService.create(userId, householdId, {
        type: 'task_assigned', title: 'New task for you',
      });
      notificationId = notification.id;
    });

    it('GET /api/v1/notifications should list notifications', async () => {
      const res = await request.get('/api/v1/notifications')
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('unreadCount');
    });

    it('PUT /api/v1/notifications/:id/read should mark as read', async () => {
      const res = await request.put(`/api/v1/notifications/${notificationId}/read`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
    });

    it('POST /api/v1/notifications/read-all should mark all read', async () => {
      const res = await request.post('/api/v1/notifications/read-all')
        .set('Cookie', authCookie)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('marked');
    });

    it('DELETE /api/v1/notifications/:id should delete notification', async () => {
      const res = await request.delete(`/api/v1/notifications/${notificationId}`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
    });

    it('PUT /api/v1/notifications/preferences/:householdId should set quiet hours', async () => {
      const res = await request.put(`/api/v1/notifications/preferences/${householdId}`)
        .set('Cookie', authCookie)
        .send({ quietStart: '22:00', quietEnd: '07:00' });
      expect(res.status).toBe(200);
    });

    it('GET /api/v1/notifications/preferences/:householdId should get quiet hours', async () => {
      const res = await request.get(`/api/v1/notifications/preferences/${householdId}`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
    });
  });

  // --- Export ---
  describe('Export', () => {
    let householdId;

    beforeAll(async () => {
      const { default: householdService } = await import('../../src/services/household-service.js');
      const household = householdService.createHousehold('Export Family', userId);
      householdId = household.id;
    });

    it('GET /:householdId/export/tasks should return CSV', async () => {
      const res = await request.get(`/api/v1/${householdId}/export/tasks`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
    });

    it('GET /:householdId/export/events should return CSV', async () => {
      const res = await request.get(`/api/v1/${householdId}/export/events`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });
  });

  // --- Audit ---
  describe('Audit', () => {
    let householdId;

    beforeAll(async () => {
      const { default: householdService } = await import('../../src/services/household-service.js');
      const household = householdService.createHousehold('Audit Family', userId);
      householdId = household.id;

      // Create an audit entry directly
      const { default: auditService } = await import('../../src/services/audit-service.js');
      auditService.log(householdId, userId, {
        action: 'create', entityType: 'task', entityId: 1, details: { title: 'Test task' },
      });
    });

    it('GET /:householdId/audit should return audit entries', async () => {
      const res = await request.get(`/api/v1/${householdId}/audit`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('total');
    });

    it('GET /:householdId/audit should support query params', async () => {
      const res = await request.get(`/api/v1/${householdId}/audit?action=create&entityType=task&limit=10`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  // --- Profile ---
  describe('Profile', () => {
    it('GET /api/v1/households/profile should get profile', async () => {
      const res = await request.get('/api/v1/households/profile')
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
    });

    it('PUT /api/v1/households/profile should update profile', async () => {
      const res = await request.put('/api/v1/households/profile')
        .set('Cookie', authCookie)
        .send({ displayName: 'Updated Name', pronouns: 'they/them' });
      expect(res.status).toBe(200);
    });
  });

  // --- Availability ---
  describe('Availability', () => {
    let householdId, blockId;

    beforeAll(async () => {
      const { default: householdService } = await import('../../src/services/household-service.js');
      const household = householdService.createHousehold('Avail Family', userId);
      householdId = household.id;
    });

    it('POST /:householdId/availability should create block', async () => {
      const now = Math.floor(Date.now() / 1000);
      const res = await request.post(`/api/v1/${householdId}/availability`)
        .set('Cookie', authCookie)
        .send({ startTime: now, endTime: now + 7200, reason: 'Doctor appointment' });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      blockId = res.body.data.id;
    });

    it('GET /:householdId/availability should list household availability', async () => {
      const res = await request.get(`/api/v1/${householdId}/availability`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
    });

    it('GET /:householdId/availability/me should list own availability', async () => {
      const res = await request.get(`/api/v1/${householdId}/availability/me`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
    });

    it('DELETE /:householdId/availability/:blockId should delete block', async () => {
      const res = await request.delete(`/api/v1/${householdId}/availability/${blockId}`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
    });
  });

  // --- Rotations ---
  describe('Rotations', () => {
    let householdId, rotationId;

    beforeAll(async () => {
      const { default: householdService } = await import('../../src/services/household-service.js');
      const household = householdService.createHousehold('Rotation Family', userId);
      householdId = household.id;
    });

    it('POST /:householdId/rotations should create rotation', async () => {
      const res = await request.post(`/api/v1/${householdId}/rotations`)
        .set('Cookie', authCookie)
        .send({ name: 'Dish Duty', memberIds: [userId] });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      rotationId = res.body.data.id;
    });

    it('GET /:householdId/rotations/:rotationId should get rotation', async () => {
      const res = await request.get(`/api/v1/${householdId}/rotations/${rotationId}`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Dish Duty');
    });

    it('DELETE /:householdId/rotations/:rotationId should delete rotation', async () => {
      const res = await request.delete(`/api/v1/${householdId}/rotations/${rotationId}`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(200);
    });
  });
});
