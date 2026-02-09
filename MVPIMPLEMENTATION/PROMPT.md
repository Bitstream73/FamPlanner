# FamPlanner MVP — Autonomous Build

## 0. Orient (Do This Every Iteration)

Read these files to understand current state:
- `MVPIMPLEMENTATION/CLAUDE.md` — project standards (code style, testing, architecture)
- `MVPIMPLEMENTATION/PROGRESS.md` — current phase and task status (YOU update this file)
- `MVPIMPLEMENTATION/docs/*.md` — detailed specs for the current phase's domain

Check git log for what was done in previous iterations:
- `git log --oneline -20`

Check existing codebase structure:
- `ls src/` to understand current layout
- Read existing services/routes to match patterns

## 1. Determine Current Task

Read `MVPIMPLEMENTATION/PROGRESS.md` to find the current phase and the next unchecked task.
- If the current task is already complete (checkbox checked), move to the next.
- If all tasks in a phase are complete, advance to the next phase.
- If ALL phases are complete, output: <promise>ALL_PHASES_COMPLETE</promise>

## 2. Execute the Current Task

Follow the spec in the relevant `MVPIMPLEMENTATION/docs/*.md` file for the current phase.

Phase-to-doc mapping:
- Phase 1 (DB Schema) → `docs/DATABASE_MVP.md`
- Phase 2 (Accounts & Roles) → `docs/HOUSEHOLDS.md`
- Phase 3 (Calendar) → `docs/CALENDAR.md`
- Phase 4 (Chores & Tasks) → `docs/TASKS.md`
- Phase 5 (Routines) → `docs/ROUTINES.md`
- Phase 6 (Communication) → `docs/COMMUNICATION.md`
- Phase 7 (Handbook) → `docs/HANDBOOK.md`
- Phase 8 (Notifications) → `docs/NOTIFICATIONS.md`
- Phase 9 (Security & Data) → `docs/SECURITY.md`
- Phase 10 (API Routes) → `docs/API_MVP.md`
- Phase 11 (Frontend) → `docs/API_MVP.md` (endpoint reference for UI)
- Phase 12 (Deploy) → existing Railway/Docker config

For EVERY task:
1. Write or update tests FIRST (test file next to source, or `tests/integration/`)
2. Implement the code to make tests pass
3. Run verification: `npx vitest run`
4. If tests fail, fix the code (NOT the tests)
5. When green, commit: `git add -A && git commit -m "type(scope): task description"`

New files go in the existing project tree (`src/`, `tests/`, `public/`), NOT in MVPIMPLEMENTATION/.
MVPIMPLEMENTATION/ contains only planning/progress docs.

## 3. Update Progress

After committing, update `MVPIMPLEMENTATION/PROGRESS.md`:
- Check off the completed task: `- [x] Task description`
- Update "Last Updated" timestamp and "Last Commit" hash
- If the phase is done, mark it ✅ and advance "Current Phase"
- Save the file

## 4. Assess Completion

- If there are more tasks remaining: continue to the next task if context allows, otherwise exit cleanly
- If ALL phases and ALL tasks are done: output <promise>ALL_PHASES_COMPLETE</promise>

## 5. If Stuck

- If a task fails after 3 attempts, add: `- [ ] Task ⚠️ BLOCKED: [reason]`
- Move to the next task if possible
- If all remaining tasks are blocked: `⚠️ ALL REMAINING TASKS BLOCKED — human intervention needed`
- NEVER output <promise>ALL_PHASES_COMPLETE</promise> unless EVERY task is genuinely done and verified

## Rules — Non-Negotiable

- **Read PROGRESS.md first, every iteration.** It is your memory.
- **One logical commit per task.** Not per iteration, not per file.
- **Never modify tests to make them pass.** Fix the underlying code.
- **Never skip verification.** Run `npx vitest run` after every task.
- **Never output the completion promise unless all work is done.**
- **Reference docs/*.md for detailed specs** — don't guess schemas, APIs, or security rules.
- **Match existing code patterns** — read neighboring files before writing new ones.
- **All implementation files go in `src/`, `tests/`, `public/`** — not in MVPIMPLEMENTATION/.
