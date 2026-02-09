# Build Progress

## Current Status
- **Current Phase:** 7
- **Last Updated:** 2026-02-09T17:50Z
- **Last Commit:** pending

## Phase 0: Environment & Credentials ✅
- [x] Node.js 20+, npm, git verified
- [x] SQLite (better-sqlite3) working
- [x] Vitest + Supertest configured
- [x] Existing auth system (bcrypt + 2FA) operational
- [x] Socket.IO configured
- [x] Railway deployment pipeline working
- [x] .env with all required keys

## Phase 1: Database Schema Extensions ✅
- [x] Create households + household_members tables migration
- [x] Create profiles table migration (extend existing users)
- [x] Create calendar_events + availability_blocks tables migration
- [x] Create tasks + task_checklists + task_rotations tables migration
- [x] Create routines + routine_steps tables migration
- [x] Create announcements + comments + mentions tables migration
- [x] Create handbook_entries table migration
- [x] Create notifications + audit_log tables migration
- [x] Create migration runner and verify all tables exist
- [x] Tests for all migrations (create, verify schema, rollback)

## Phase 2: Accounts & Roles ✅
- [x] Household service: create household with owner
- [x] Household service: generate invite link (crypto random token, 48h expiry)
- [x] Household service: accept invite (validate token, add member)
- [x] Role service: assign role (Parent/Guardian, Teen, Kid, Caregiver)
- [x] Permission engine: check permission by role + action
- [x] Profile service: update name, avatar URL, pronouns
- [x] Household service: list members, remove member, transfer ownership
- [x] Tests for household, role, permission, and profile services

## Phase 3: Calendar & Coverage ✅
- [x] Calendar service: create event (title, location, start/end, notes, creator)
- [x] Calendar service: update and delete events (with permission check)
- [x] Calendar service: assign responsible person to event
- [x] Availability service: create/update/delete availability blocks per user
- [x] Conflict detection: overlap check + "no responsible person" warnings
- [x] Recurring events: weekly recurrence with series linking
- [x] Calendar queries: day view, week view, month view with filters
- [x] Tests for calendar, availability, conflict, and recurrence

## Phase 4: Chores & Tasks ✅
- [x] Task service: create task (one-time or recurring, assignee, due date)
- [x] Task service: update, delete, reassign tasks
- [x] Task checklist service: add/remove/reorder sub-steps, toggle complete
- [x] Task metadata: time estimate + difficulty tag (easy/medium/hard)
- [x] Task completion: mark done with optional note and photo URL
- [x] Rotation service: round-robin assignee for recurring tasks
- [x] Reminder service: attach reminder rules to tasks (on due, 1hr before)
- [x] Task view queries: Today, Upcoming (next 7 days), Overdue
- [x] Tests for task CRUD, checklists, rotations, reminders, views

## Phase 5: Routines ✅
- [x] Routine service: create routine (name, type: morning/evening/leaving)
- [x] Routine step service: add/remove/reorder steps in routine
- [x] Routine execution: start routine, tap-to-complete each step
- [x] Routine auto-reset: daily reset option (clear completed steps at midnight)
- [x] Tests for routine CRUD, execution, and auto-reset

## Phase 6: Communication ✅
- [x] Announcement service: create, list, pin/unpin announcements in household
- [x] Comment service: add/list comments on tasks and events (polymorphic)
- [x] Mention parser: extract @username from text, create mention records
- [x] Quiet hours service: set/get quiet hours per user (start/end times)
- [x] Socket.IO integration: broadcast announcements and comments in real-time
- [x] Tests for announcements, comments, mentions, quiet hours

## Phase 7: Household Handbook
- [ ] Handbook service: create pinned note (title, content, pinned boolean)
- [ ] Handbook service: create how-to entry (title, steps array, image URLs)
- [ ] Handbook service: update, delete, list, search entries
- [ ] Tests for handbook CRUD and search

## Phase 8: Notifications
- [ ] Notification service: create, list, mark read, delete notifications
- [ ] Push notification dispatcher: queue and send via web push API
- [ ] Email notification dispatcher: send via Resend (existing integration)
- [ ] Reminder rule engine: on-due, 1-hour-before, daily-digest scheduling
- [ ] Quiet hours filter: suppress notifications during user quiet hours
- [ ] Tests for notification CRUD, dispatchers, reminders, quiet hours filter

## Phase 9: Security & Data
- [ ] Audit log service: record who edited/deleted tasks, events, household changes
- [ ] Audit log queries: filter by user, entity type, action, date range
- [ ] Data export service: generate CSV for user's tasks and events
- [ ] Tests for audit logging, queries, and CSV export

## Phase 10: API Routes
- [ ] Household routes: POST/GET/PUT/DELETE /api/v1/households, invite, join
- [ ] Member routes: GET/PUT/DELETE /api/v1/households/:id/members
- [ ] Profile routes: GET/PUT /api/v1/profile
- [ ] Calendar routes: full CRUD /api/v1/events, availability blocks
- [ ] Task routes: full CRUD /api/v1/tasks, checklists, rotations
- [ ] Routine routes: full CRUD /api/v1/routines, execution endpoints
- [ ] Communication routes: /api/v1/announcements, /api/v1/comments
- [ ] Handbook routes: full CRUD /api/v1/handbook
- [ ] Notification routes: GET/PUT/DELETE /api/v1/notifications
- [ ] Export routes: GET /api/v1/export/tasks, /api/v1/export/events
- [ ] Audit routes: GET /api/v1/audit-log (admin only)
- [ ] Integration tests for all route groups

## Phase 11: Frontend UI
- [ ] Dashboard page: household overview, today's events, pending tasks
- [ ] Household management: create, invite, member list, role management
- [ ] Calendar view: day/week/month with event creation/editing modals
- [ ] Tasks view: Today/Upcoming/Overdue tabs, task detail with checklists
- [ ] Routines view: routine list, execution checklist UI
- [ ] Communication: announcements feed, comment threads on tasks/events
- [ ] Handbook view: pinned notes list, how-to detail pages
- [ ] Notifications: bell icon with dropdown, notification preferences

## Phase 12: Deployment & Verification
- [ ] Update Dockerfile for new dependencies (if any)
- [ ] Update CI/CD workflow to include new test files
- [ ] Deploy to Railway
- [ ] Verify all new API endpoints on production
- [ ] Full test suite green on CI
