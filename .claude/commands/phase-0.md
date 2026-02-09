# Phase 0: Environment Setup & Credential Verification

## Objective
Collect and verify all required credentials before writing any code.

## Plan First
Propose your plan for verifying connectivity to each service. Wait for user approval.

## Required Credentials

Ask the user for a `.md` file with credentials, or guide them through each:

### 1. GitHub Access
Use the GitHub Claude Code skill (`gh` CLI). Verify: `gh auth status`

### 2. Google AI (Gemini) API Key
- User provides their API key from https://aistudio.google.com/app/apikey
- Verify connectivity:
```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" | head -c 200
```
- Note the latest stable model name from the response.

### 3. Pinecone API Key & Index Host
- User provides API key from https://www.pinecone.io/
- User provides Index Host URL
- Verify connectivity:
```bash
curl -s -H "Api-Key: $PINECONE_API_KEY" "$PINECONE_INDEX_HOST/describe_index_stats" | head -c 200
```

### 4. Railway Access
Use the Railway Claude Code skill. Verify: `railway whoami`

### 5. Resend API Key (Email 2FA)
- User provides API key from https://resend.com/
- User provides their verified sender email (e.g., `noreply@yourdomain.com`)
- Verify connectivity:
```bash
curl -s -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/domains | head -c 200
```

## Verification Gate

**STOP if any connection fails.** Report exactly which service failed and what error was returned. Do not proceed to Phase 1.

Confirm all five connections:
- [ ] GitHub: `gh auth status` succeeds
- [ ] Gemini: API responds with model list
- [ ] Pinecone: Index stats endpoint responds
- [ ] Railway: `railway whoami` succeeds
- [ ] Resend: Domains endpoint responds

## Output

Create `.env` (gitignored) with real values:
```
NODE_ENV=development
PORT=3000
DATABASE_PATH=./data/database.sqlite
GEMINI_API_KEY=<real_key>
PINECONE_API_KEY=<real_key>
PINECONE_INDEX_HOST=<real_host>
RESEND_API_KEY=<real_key>
RESEND_FROM_EMAIL=<verified_sender_email>
SESSION_SECRET=<random_32+_char_string>
```

Create `.env.example` (committed) with placeholders:
```
NODE_ENV=development
PORT=3000
DATABASE_PATH=./data/database.sqlite
GEMINI_API_KEY=your_gemini_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_HOST=your_pinecone_index_host
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
SESSION_SECRET=generate_a_random_string_at_least_32_chars
```

## Checkpoint
```bash
# No git commit yet — Phase 1 creates the repo
```

Report: "Phase 0 complete. All services verified. Ready for /phase-1."
