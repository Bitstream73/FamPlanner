# FamPlanner MVP — Family OS

Shared family planning app: households, calendars, chores, routines, communication. Extends existing FamPlanner backend.

## Stack

- **Runtime:** Node.js 20+ (ES modules only — never use `require()`)
- **Backend:** Express 4.x, existing FamPlanner server in `../src/`
- **Auth:** Existing bcrypt + 2FA system. Extend with household roles/permissions
- **Database:** SQLite via better-sqlite3 (WAL mode, foreign keys ON)
- **Real-time:** Socket.IO for live updates (announcements, task changes)
- **AI:** Gemini via existing service (routine suggestions, smart scheduling)
- **Tests:** Vitest + Supertest
- **Deploy:** Railway (Docker)
- **Package manager:** npm with lockfile

## Code Style

- ES modules: `import { x } from 'y'` — destructure when possible
- Files: kebab-case (`household-service.js`). Classes: PascalCase
- `const` over `let`, never `var`. Max ~40 lines per function
- Descriptive names over comments. Early returns over nesting
- Named constants, no magic numbers/strings

## Architecture

- All new MVP code lives in `src/services/`, `src/routes/`, `src/middleware/`
- Business logic in services, NOT route handlers
- Each service: single concern, clear interface, constructor injection for deps
- Database: migrations in `src/database/migrations/`, one file per table group
- Middleware: `src/middleware/` — permissions, household context, validation
- Routes: `src/routes/api/v1/` — RESTful, versioned

## Testing — MANDATORY

Every code change includes tests. No exceptions.

- Test behavior, not implementation. Arrange-Act-Assert
- Descriptive names: `should return 403 when kid tries to assign tasks`
- Unit tests next to source: `foo.js` -> `foo.test.js`
- Integration tests: `tests/integration/`
- Run: `npx vitest run` — must be green before commit
- Mock external deps at boundary only

## Verification

1. `npx vitest run` — all tests green
2. No hardcoded secrets — env vars only
3. No plaintext passwords/tokens in logs

## Git

- Format: `type(scope): description` — e.g., `feat(calendar): add event CRUD service`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- One logical change per commit

## Sensitive Areas

- **Household invites:** Tokens must be cryptographically random, time-limited
- **Role permissions:** Enforce server-side, never trust client
- **Kid accounts:** Limited data access, no delete permissions
- **Session/auth:** httpOnly, secure, sameSite strict cookies
- **Audit log:** Never log passwords, tokens, or 2FA codes

## When Stuck

- 3 failed attempts: stop, document in PROGRESS.md, move on
- Long context: suggest compacting
- Ambiguous requirements: reference Quinyx-style patterns for family context

## Known Mistakes to Avoid

- Don't use CommonJS (`require`) — ES modules only
- Don't log API keys, tokens, passwords, 2FA codes, or session IDs
- Don't modify tests to make them pass — fix the code
- Don't skip verification after each task
- Don't bundle multiple tasks into one commit
- Don't put business logic in route handlers
- Don't trust client-side role checks — always verify server-side
