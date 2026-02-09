# Quote Log

A production-ready full-stack Node.js app for a Family Planning app called FamPlanner. Uses Gemini AI, Pinecone vector database, SQLite, Socket.IO real-time updates, and deploys to Railway as a Progressive Web App.

## Stack

- **Runtime:** Node.js 20+ (ES modules only — never use `require()`)
- **Backend:** Express 4.x
- **Auth:** Email 2FA via Resend, bcrypt password hashing, httpOnly session cookies
- **Database:** SQLite via better-sqlite3 (WAL mode, foreign keys ON)
- **Vector DB:** Pinecone
- **AI:** Google Gemini (latest stable model)
- **Real-time:** Socket.IO
- **Tests:** Vitest + Supertest
- **Deploy:** Railway (Docker)
- **Package manager:** npm — always use lockfile

## Code Style

- ES modules: `import { x } from 'y'` — destructure when possible
- Files: kebab-case (`quote-extractor.js`). Components: PascalCase
- `const` over `let`, never `var`
- Max ~40 lines per function — extract helpers if longer
- Descriptive names over comments. Comments explain *why*, not *what*
- Named constants, no magic numbers/strings
- Early returns over nested conditionals
- Handle errors explicitly — never swallow exceptions

## Architecture

- Check neighboring files for patterns before writing new code
- Business logic stays out of route handlers
- Loose coupling, clear interfaces between modules
- Logging is a cross-cutting concern — every service uses the logger (see `docs/LOGGING.md`)
- Authentication is a cross-cutting concern — see `docs/AUTH.md` for the full spec

## Testing — MANDATORY

Every code change includes tests. No exceptions.

- Test behavior, not implementation. Don't spy on internals
- Arrange → Act → Assert with descriptive names: `should return 404 when user does not exist`
- Cover: happy path, edge cases, error cases
- Unit tests live next to source: `foo.js` → `foo.test.js`
- Integration tests in `tests/integration/`
- Run single files for speed: `npx vitest run path/to/file.test.js`
- Mock external dependencies at the boundary only

## Verification — Run Before Declaring Done

1. `npx vitest run` — all tests green
2. `npm run build` — succeeds (if applicable)
3. No hardcoded secrets anywhere — use env vars

## Git

- Commits: `type(scope): description` — e.g., `feat(ai): add quote extraction endpoint`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- One logical change per commit. Never bundle unrelated work
- **Commit after each passing phase** as a checkpoint

## Sensitive Areas — Extra Caution

- **Auth/passwords/2FA:** bcrypt only, NEVER log plaintext passwords or codes. See `docs/AUTH.md`
- **Session cookies:** httpOnly, secure in production, sameSite strict. NEVER log session tokens
- **API key handling:** env vars only, redact in logs
- **Database migrations:** include rollback path
- **Pinecone operations:** log all calls with timing
- **Dockerfile/Railway config:** test health check locally first

## When Stuck

- If failing after 3 attempts, stop and explain what's wrong
- If context is long and responses degrade, suggest compacting
- Ask clarifying questions rather than guessing

## Known Mistakes to Avoid

- Don't use CommonJS (`require`) — this is an ES modules project
- Don't log API keys, tokens, passwords, 2FA codes, or session IDs — use the sanitizer in logger service
- Don't store plaintext passwords or 2FA codes — always bcrypt hash
- Don't set cookies without httpOnly and sameSite flags
- Don't modify tests to make them pass — fix the underlying code
- Don't skip the verification step at the end of each phase
- Don't bundle multiple phases into one commit
