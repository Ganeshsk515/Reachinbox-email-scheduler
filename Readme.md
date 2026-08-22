# ReachInbox Email Scheduler

A production-style email scheduling system built for the ReachInbox / Outbox Labs hiring assignment. Users log in with Google, compose an email (single recipient or bulk via CSV upload), schedule it for a future time, and the backend reliably delivers it via BullMQ delayed jobs — surviving restarts, respecting per-sender rate limits, and never double-sending.

## Tech Stack

**Backend:** TypeScript (strict mode), Express 5, BullMQ, Redis (ioredis), PostgreSQL (raw SQL via `pg`, no ORM), Nodemailer (Ethereal fake SMTP), Zod (validation), Vitest (unit tests)
**Frontend:** Next.js (App Router), TypeScript, Tailwind CSS 4, NextAuth v5 (Google OAuth)
**Infra:** Docker Compose (Postgres + Redis)

## Project Structure

```
reachinbox-email-scheduler/
├── docker-compose.yml
├── backend/
│   └── src/
│       ├── config/env.ts
│       ├── lib/logger.ts
│       ├── validation/campaignSchema.ts
│       ├── db/
│       │   ├── client.ts
│       │   ├── schema.sql
│       │   └── campaignRepo.ts
│       ├── queue/
│       │   ├── connection.ts
│       │   ├── emailQueue.ts
│       │   ├── worker.ts
│       │   ├── rateLimiter.ts
│       │   ├── rateLimiter.test.ts
│       │   └── reconcile.ts
│       ├── routes/
│       │   ├── campaigns.ts
│       │   └── emails.ts
│       ├── services/mailer.ts
│       └── server.ts
└── frontend/
    ├── auth.ts
    ├── app/
    │   ├── page.tsx
    │   ├── login/page.tsx
    │   └── api/auth/[...nextauth]/route.ts
    ├── components/
    │   ├── Dashboard.tsx
    │   ├── Sidebar.tsx
    │   ├── EmailTable.tsx
    │   ├── ComposeModal.tsx
    │   └── ui/ (Button, Badge, Input, EmptyState, Spinner, Toast)
    └── lib/apiClient.ts
```

---

## How to Run the Backend (Express, Redis, DB, BullMQ Worker)

### 1. Start infrastructure
```bash
docker compose up -d
```
Starts Postgres and Redis. Note: Postgres is mapped to host port **5433** (not 5432) in this project's `docker-compose.yml` to avoid a local port conflict — adjust if 5432 is free on your machine.

### 2. Apply the database schema
```bash
docker cp backend/src/db/schema.sql reachinbox-postgres:/schema.sql
docker exec -it reachinbox-postgres psql -U reachinbox -d reachinbox -f /schema.sql
```

### 3. Install dependencies and configure environment
```bash
cd backend
npm install
```

Create `backend/.env`:
```
PORT=4000
DATABASE_URL=postgresql://reachinbox:reachinbox_dev_password@localhost:5433/reachinbox
REDIS_HOST=localhost
REDIS_PORT=6379
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=<your-ethereal-username>
ETHEREAL_PASS=<your-ethereal-password>
WORKER_CONCURRENCY=5
MIN_DELAY_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200
```

See "Ethereal Email Setup" below for how to get the SMTP credentials.

Seed at least one sender row (used by both the backend and the frontend's compose form):
```bash
docker exec -it reachinbox-postgres psql -U reachinbox -d reachinbox -c "INSERT INTO senders (name, smtp_user, smtp_pass) VALUES ('Ethereal Test Sender', '<your-ethereal-username>', '<your-ethereal-password>') RETURNING *;"
```
Copy the returned `id` (UUID) — the frontend's `ComposeModal.tsx` currently references one sender by this UUID directly (see Trade-offs).

### 4. Run the API server and the worker
These are **two separate long-running processes** — run each in its own terminal:
```bash
npm run dev                      # Express API server, http://localhost:4000
npx tsx src/queue/worker.ts       # BullMQ worker (sends emails, enforces rate limits)
```

Confirm the API is up:
```bash
curl http://localhost:4000/health
# → {"status":"ok","db":"connected"}
```

### 5. (Optional) Run backend tests
```bash
npm test
```
Runs the Vitest suite covering the rate limiter's pure scheduling logic.

---

## How to Run the Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```
AUTH_SECRET=<random-generated-secret>
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>
```

Generate `AUTH_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Create Google OAuth credentials at [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → Create Credentials → OAuth Client ID → **Web application**, with:
- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

Run the frontend:
```bash
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/login` if not authenticated.

---

## Ethereal Email Setup

[Ethereal Email](https://ethereal.email) is a fake SMTP service for testing — no real emails are delivered, but full send/receive behavior (including a viewable preview) is simulated.

1. Go to [ethereal.email](https://ethereal.email) and click **"Create Ethereal Account."**
2. Copy the generated **SMTP username and password**.
3. Paste them into `backend/.env` as `ETHEREAL_USER` and `ETHEREAL_PASS`.
4. Seed a `senders` row in Postgres using these same credentials (see backend setup step 3 above) — the worker looks up sender credentials dynamically from this table at send time, rather than using one hardcoded global account.
5. Every time an email "sends" successfully, the worker logs a `Preview URL` — open it in a browser to see exactly what was sent, as Ethereal received it.

---

## Architecture Overview

### How scheduling works
Every scheduled email becomes a **BullMQ delayed job**, with the delay computed as `scheduledFor - now()`. There is no cron job, OS crontab, or polling loop anywhere in this system — BullMQ persists the delayed job directly in Redis, so it exists independently of any running process.

When a campaign is created via `POST /api/campaigns`:
1. One `campaigns` row is written to Postgres.
2. One `email_jobs` row is written per recipient, each with its own `scheduled_for` timestamp (spaced by `delayBetweenMs` to preserve send order).
3. One BullMQ job is enqueued per recipient, using that `email_jobs` row's Postgres UUID directly as the BullMQ `jobId`.

This UUID reuse is the foundation of the system's idempotency guarantee (see below).

### How persistence on restart is handled
Two independent layers protect against data loss or duplication on restart:

**Layer 1 — Redis outlives the process.** BullMQ's delayed-job timers live in Redis, not in the worker's memory. Killing and restarting the worker process has no effect on correctness: the timer keeps counting down in Redis regardless of whether a worker is currently listening. This was manually verified: a campaign was scheduled, the worker process was fully killed (`Ctrl+C`), left off for 10+ seconds, then restarted — the email still sent automatically at the correct original time, confirmed via a direct SQL query showing exactly one `sent` row, no duplicates.

**Layer 2 — DB-reconciliation on boot** (for the harder case: what if Redis itself loses its data, not just the process). Every time the worker starts, `reconcileOnBoot()` checks Postgres for any `email_jobs` rows still marked `scheduled`, checks each one's actual state in BullMQ, and only re-enqueues jobs that are genuinely missing or lost — it deliberately does not blindly re-add every pending row, avoiding duplicate jobs for ones already safely queued.

### Idempotency (two independent layers)
1. **Queue-level:** each `email_jobs.id` is reused as the BullMQ `jobId`. BullMQ refuses to enqueue a duplicate job with the same ID.
2. **Application-level:** before actually sending, the worker independently checks the job's current DB `status`. If it's already `sent`, the send is skipped entirely — even if the job were somehow triggered twice (e.g. a theoretical race between a rate-limit reschedule and boot-time reconciliation). The database is the final source of truth, not BullMQ alone.

### How rate limiting & concurrency are implemented
- **Concurrency:** configurable via `WORKER_CONCURRENCY` (default 5), passed directly into BullMQ's `Worker` options.
- **Minimum delay between sends:** configurable via `MIN_DELAY_MS` (default 2000ms), enforced using BullMQ's built-in `limiter` option (`max: 1` per `duration: MIN_DELAY_MS`).
- **Hourly rate limit, per sender:** configurable via `MAX_EMAILS_PER_HOUR_PER_SENDER` (default 200). Enforced using an atomic Redis `INCR` counter keyed as `rate:{senderId}:{YYYY-MM-DDTHH}`, with a 1-hour TTL set via `EXPIRE` on the first increment of each hour window. This is safe across multiple worker processes because Redis's `INCR` is atomic — no in-memory counters are used anywhere.

**When the hourly limit is hit:** the job is not failed or dropped. It's re-enqueued with a delay landing at the start of the next hour window, using a new BullMQ job ID (`{originalJobId}-rl{retryCount}`) since the original ID has already been consumed. The database's `bullmq_job_id` column is kept in sync so reconciliation always checks the current, correct job ID. The row's `status` remains `scheduled` throughout.

This was verified by temporarily lowering `MAX_EMAILS_PER_HOUR_PER_SENDER` to 2 and scheduling 4 emails: the first 2 sent normally, and the worker logged `Rate limit hit for sender ..., rescheduling job ... to <next-hour-timestamp>` for the remaining 2 — confirmed via SQL showing 2 `sent` rows and 2 `scheduled` rows with `scheduled_for` correctly pushed into the next hour.

### Behavior under load
When bulk-scheduling via `POST /api/campaigns`, each recipient gets an individually delayed job spaced `delayBetweenMs` apart, preserving send order without any additional locking logic. This was stress-tested with a real 1000-recipient campaign: the API accepted and created all 1000 rows without error, the worker processed them in strict order, and after a period of processing, Postgres showed 52 `sent` and 948 `scheduled` (correctly pending/rate-limited) — zero failures, zero data corruption at scale.

### Input validation and error handling
All `POST /api/campaigns` requests are validated with **Zod** before touching the database — malformed subjects, invalid sender UUIDs, invalid email addresses, or empty recipient lists are rejected with clear, field-level error messages rather than silently failing or crashing.

### Logging and graceful shutdown
The backend uses a small structured logger (timestamped, leveled: info/warn/error) instead of raw `console.log` scattered through the codebase. Both the API server and the worker listen for `SIGINT`/`SIGTERM` and shut down gracefully — the server closes its Postgres connection pool cleanly, and the worker closes its Redis connection — rather than terminating mid-operation.

---

## API Reference

```
POST /api/campaigns
  Body: { subject, body, senderId, delayBetweenMs, maxEmailsPerHour, startTime, createdBy, recipients: string[] }
  → 201 { campaignId, emailsScheduled }
  → 400 { error: "Validation failed", details: {...} }  (Zod field-level errors)

GET  /api/campaigns/:id
  → full campaign row

GET  /api/emails?status=scheduled|sent|failed&limit=&offset=
  → { jobs: [{ id, recipient_email, status, scheduled_for, sent_at, subject }] }

GET  /health
  → { status: "ok", db: "connected" }
```

---

## Features Implemented

### Backend
| Requirement | Status |
|---|---|
| Scheduler (BullMQ delayed jobs, no cron) | ✅ Implemented and verified |
| Persistence across restart | ✅ Implemented and verified (real kill/restart test) |
| Rate limiting (per sender, per hour, distributed-safe) | ✅ Implemented and verified (real overflow test) |
| Concurrency (configurable worker concurrency + min delay) | ✅ Implemented |
| Idempotency | ✅ Two independent layers (BullMQ jobId + DB status check) |
| DB-reconciliation on boot | ✅ Implemented and verified |
| Dynamic per-sender SMTP credentials | ✅ Implemented (worker fetches from DB, not a hardcoded global transporter) |
| Input validation | ✅ Zod schemas on all write endpoints |
| Structured logging | ✅ Timestamped, leveled logger |
| Graceful shutdown | ✅ SIGINT/SIGTERM handling on both server and worker |
| Unit tests | ✅ Vitest suite for rate-limiter scheduling logic |
| Full REST API | ✅ Create campaign, list scheduled/sent, campaign detail, health check |

### Frontend
| Requirement | Status |
|---|---|
| Google OAuth login (real, not mocked) | ✅ NextAuth v5, verified with a real Google account |
| Dashboard with user info (name/email/avatar) in header | ✅ |
| Logout | ✅ |
| Scheduled Emails tab | ✅ Live count, real backend data |
| Sent Emails tab | ✅ Live count, real backend data |
| Compose New Email | ✅ Subject, body, CSV upload with live recipient-count detection, removable chips, delay/hourly-limit inputs |
| Loading states | ✅ |
| Empty states | ✅ |
| Toast notifications (success/error feedback) | ✅ |
| Own color palette & typography | ✅ Indigo/violet accent, Inter font, semantic status badges — layout follows the provided Figma closely, colors are original |

---

## Assumptions, Shortcuts, and Trade-offs

- **The frontend's sender selection is hardcoded** to a single seeded Ethereal sender's UUID rather than offering a sender-management UI, since only one test sender exists for this assignment's scope. The backend itself fully supports multiple senders with independently stored credentials.
- **Test coverage is intentionally scoped**, not exhaustive. Given the assignment's time constraint, unit tests focus on the rate limiter's pure, deterministic scheduling logic (`getStartOfNextHour`). Restart-persistence, idempotency, and rate-limit-overflow behavior were verified manually via real API calls and direct SQL/Redis inspection rather than automated integration tests — each of these was independently confirmed multiple times during development.
- **CSV parsing** uses `papaparse` and filters parsed rows to anything containing `@`, so a header row without an `@` symbol is automatically excluded from the recipient list.
- **Google OAuth runs in "Testing" mode** in Google Cloud Console (not published/verified), which is expected and sufficient for local development and demo purposes.
- **Email detail view** (a full single-email reading view) was intentionally not built — the assignment's explicit requirement is a table/list view with Email/Subject/Time/Status columns, which is what's implemented.