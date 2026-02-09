# Quote Log — Full Scaffold Orchestrator

You are scaffolding Family Planning Application called FamPlanner. This is a multi-phase build. Execute each phase as a separate slash command, in order.

## Before Starting

1. Read `CLAUDE.md` in the project root (your persistent context)
2. Read `docs/LOGGING.md` (the logging specification — applies to ALL phases)
3. Read `docs/AUTH.md` (the authentication specification — applies to Phases 4A, 6, and 8)

## Phase Sequence

Run these commands in order. Each phase must pass all tests and be committed before proceeding:

1. `/phase-0` — Environment setup & credential verification
2. `/phase-1` — Project initialization & GitHub repository
3. `/phase-2` — Configuration, database & logging foundation
4. `/phase-3` — Vector database setup (Pinecone)
5. `/phase-4` — Express server & middleware
6. `/phase-4a` — User authentication & email 2FA (Resend)
7. `/phase-5` — AI service integration (Gemini)
8. `/phase-6` — Frontend, routes & logs viewer (includes login/register UI)
9. `/phase-7` — GitHub CI/CD workflow
10. `/phase-8` — Railway deployment & verification

## Rules For Every Phase

- **Plan first:** Propose your plan for the phase. Wait for approval before implementing.
- **Tests are mandatory:** Write tests alongside (or before) the implementation.
- **Verify before done:** Run `npx vitest run` and confirm all green.
- **Checkpoint:** `git add -A && git commit -m "phase-N: description"` after tests pass.
- **Logging:** Every service you create must use the logger. See `docs/LOGGING.md`.
- **Never modify tests to make them pass.** Fix the underlying code.
- **Stay focused:** Do not refactor code from previous phases unless it's broken.

## If Something Goes Wrong

- If a phase fails after 3 attempts, stop and report what's not working.
- If context gets long, suggest compacting before continuing.
- If credentials are missing or invalid, stop immediately and tell the user.
