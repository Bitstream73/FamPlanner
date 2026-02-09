# Quote Log — Claude Code Scaffold

## How This Works

This scaffold follows enterprise best practices sourced from Anthropic's internal teams and Boris Cherny (creator of Claude Code). Instead of one giant prompt, it uses **slash commands** — each phase is a focused, testable unit with its own plan → implement → verify → commit cycle.

## Quick Start

1. **Copy this entire folder** to your working directory
2. **Open Claude Code CLI** in the project root
3. Run: `/scaffold` — this is the orchestrator that walks you through all phases
4. Or run phases individually: `/phase-0`, then `/phase-1`, etc.

## File Structure

```
CLAUDE.md                          ← Project brain (always loaded, ~85 lines)
docs/
  LOGGING.md                       ← Logging spec (progressive disclosure)
  AUTH.md                          ← Authentication & 2FA spec (progressive disclosure)
  SCAFFOLD_README.md               ← This file
.claude/commands/
  scaffold.md                      ← Orchestrator — explains the full sequence
  phase-0.md                       ← Environment setup & credential verification
  phase-1.md                       ← Project init & GitHub repo
  phase-2.md                       ← Config, database & logging foundation
  phase-3.md                       ← Pinecone vector database
  phase-4.md                       ← Express server & middleware
  phase-4a.md                      ← User auth with email 2FA via Resend
  phase-5.md                       ← Gemini AI service
  phase-6.md                       ← Frontend, routes & logs viewer (auth-aware)
  phase-7.md                       ← GitHub CI/CD
  phase-8.md                       ← Railway deployment & verification
```

## Design Principles (Why It's Built This Way)

### Concise CLAUDE.md (~100 lines, ~2.5k tokens)
Boris Cherny's team at Anthropic keeps their CLAUDE.md at this size. Research from HumanLayer shows instruction-following degrades as file length increases. Keep it short, universally applicable.

### Progressive Disclosure
The logging spec lives in `docs/LOGGING.md`, not in CLAUDE.md. Claude only reads it when a phase references it. This keeps the base context window lean.

### Plan First, Then Execute
Every phase starts with "Propose your plan. Wait for approval." This matches Boris Cherny's #1 workflow pattern: Plan Mode → iterate → auto-accept. It prevents Claude from making 40 changes you didn't want.

### Git Checkpoints After Every Phase
Anthropic's RL Engineering team uses "try and rollback" methodology. Each phase commits separately so you can revert if a later phase breaks things.

### Tests Are Mandatory, Not Optional
Anthropic's Security Engineering team transformed from "write code → give up on tests" to test-first workflows. Every phase includes tests that must pass before proceeding.

### Behavior-Based Tests
The CLAUDE.md says "test behavior, not implementation." Tests check what the system does (returns 200, has correct fields) rather than spying on internal method calls.

### Known Mistakes Section
"Anytime we see Claude do something incorrectly we add it to the CLAUDE.md." — Boris Cherny. This section grows over time and compounds quality.

## Customization

- **Different AI provider?** Modify Phase 5 command
- **Different database?** Modify Phase 2 command
- **Different deployment?** Modify Phase 8 command
- **Add a phase?** Create `.claude/commands/phase-N.md` and update `scaffold.md`

## Key Differences from the Original Prompt

| Original | Refactored | Why |
|----------|-----------|-----|
| 1,900-line single prompt | 9 focused slash commands | Context window fills up fast; smaller = better |
| Tests spy on console internals | Tests check behavior/outputs | Boris Cherny: "give Claude a way to verify its work" |
| `require()` in verify script | ES modules everywhere | Consistent with CLAUDE.md — no mixed module systems |
| No plan step | Every phase plans first | Boris Cherny's #1 pattern: plan then execute |
| No git checkpoints | Commit after each phase | Anthropic RL team's rollback methodology |
| Hardcoded dep versions | "Latest stable" | Avoids stale versions; Claude can resolve current ones |
| Logging spec in main prompt | Separate `docs/LOGGING.md` | Progressive disclosure — only load when needed |
