# ReachInbox Email Scheduler

A production-style email scheduling system built for the ReachInbox / Outbox Labs hiring assignment. Users log in with Google, compose an email (single recipient or bulk via CSV upload), schedule it for a future time, and the backend reliably delivers it via BullMQ delayed jobs — surviving restarts, respecting per-sender rate limits, and never double-sending.

## Tech Stack

**Backend:** TypeScript (strict mode), Express 5, BullMQ, Redis (ioredis), PostgreSQL (raw SQL via `pg`, no ORM), Nodemailer (Ethereal fake SMTP)
**Frontend:** Next.js (App Router), TypeScript, Tailwind CSS 4, NextAuth v5 (Google OAuth)
**Infra:** Docker Compose (Postgres + Redis)

## Project Structure

```
reachinbox-email-scheduler/
├── docker-compose.yml          # Postgres + Redis
├── backend/
│   └── src/
│       ├── config/env.ts       # env var loading + validation
│       ├── db/
│       │   ├── client.ts        # pg Pool
│       │   ├── schema.sql
│       │   └── campaignRepo.ts  # all typed DB queries
│       ├── queue/
│       │   ├── connection.ts     # ioredis connection
│       │   ├── emailQueue.ts      # BullMQ Queue
│       │   ├── worker.ts           # BullMQ Worker — send logic, rate limiting, idempotency
│       │   ├── rateLimiter.ts       # Redis-backed hourly counter per sender
│       │   └── reconcile.ts          # DB-reconciliation on worker boot
│       ├── routes/
│       │   ├── campaigns.ts          # POST /api/campaigns, GET /api/campaigns/:id
│       │   └── emails.ts              # GET /api/emails?status=
│       ├── services/mailer.ts          # nodemailer + Ethereal
│       └── server.ts                    # Express app
└── frontend/
    ├── auth.ts                          # NextAuth Google provider config
    ├── app/
    │   ├── page.tsx                      # session check + redirect
    │   ├── login/page.tsx                 # login screen
    │   └── api/auth/[...nextauth]/route.ts
    ├── components/
    │   ├── Dashboard.tsx                   # main dashboard logic
    │   ├── Sidebar.tsx
    │   ├── EmailTable.tsx
    │   ├── ComposeModal.tsx
    │   └── ui/                              # Button, Badge, Input, EmptyState, Spinner
    └── lib/apiClient.ts                      # typed backend fetch wrapper
```

## Setup

### 1. Start infrastructure
```bash
docker compose up -d
```
This starts Postgres and Redis. Note: in this project's dev environment, Postgres is mapped to host port **5433** (not 5432), to avoid a local port conflict — adjust `docker-compose.yml` and connection strings if 5432 is free on your machine.

### 2. Apply the database schema
```bash
docker cp backend/src/db/schema.sql reachinbox-postgres:/schema.sql
docker exec -it reachinbox-postgres psql -U reachinbox -d reachinbox -f /schema.sql
```

### 3. Backend setup
```bash
cd backend
npm install
```

Create `backend/.env` (see `.env.example`):
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

Generate a free Ethereal test SMTP account at [ethereal.email](https://ethereal.email) — click "Create Ethereal Account" and copy the generated username/password into the env vars above.

Seed one sender row (used by the frontend's compose form):
```bash
docker exec -it reachinbox-postgres psql -U reachinbox -d reachinbox -c "INSERT INTO senders (name, smtp_user, smtp_pass) VALUES ('Ethereal Test Sender', '<your-ethereal-username>', '<your-ethereal-password>') RETURNING *;"
```
Copy the returned `id` — you'll need it as the `senderId` used by the frontend's compose flow (currently hardcoded there, see Trade-offs below).

Run the API server and the worker in **two separate terminals**:
```bash
npm run dev                      # Express API, port 4000
npx tsx src/queue/worker.ts       # BullMQ worker
```

### 4. Frontend setup
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

Create Google OAuth credentials at [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth Client ID → Web application, with:
- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

Run the frontend:
```bash
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/login`.

## Architecture

### No cron — BullMQ delayed jobs only
Every scheduled email becomes a BullMQ job with a `delay` computed from `scheduledFor - now()`. BullMQ persists this in Redis, so the job exists independently of any running process. There is no polling loop, OS crontab, or cron library anywhere in the system.

### Idempotency (two layers)
1. **Queue-level:** each `email_jobs` row's Postgres `id` (UUID) is reused directly as the BullMQ job ID. BullMQ refuses to enqueue a duplicate job with the same ID — this is the first guard.
2. **Application-level:** before actually sending, the worker independently checks the job's current DB `status`. If it's already `sent`, the worker skips the send entirely, even if it were somehow triggered twice (for example, a theoretical race between a rate-limit reschedule and the boot-time reconciliation both touching the same job). This means idempotency doesn't rely on BullMQ alone — the database is the final source of truth.

### Restart survival
The record of pending sends lives entirely in Redis (BullMQ's delayed job timers) and Postgres (`email_jobs` rows) — never in the worker process's own memory. Killing and restarting the worker mid-wait has no effect on correctness: BullMQ's delayed-job timer keeps counting down in Redis regardless of whether a worker is currently listening.

This was verified manually and repeatedly during development: a campaign was scheduled via the real API, the worker process was fully killed (`Ctrl+C`), left off for 10-15+ seconds, then restarted fresh — the email still sent automatically at the correct time, confirmed via direct SQL query to show exactly one `sent` row with no duplicates.

As a second layer of defense (for the harder case — what if Redis itself lost data, not just the process restarting), a `reconcileOnBoot()` step runs every time the worker starts: it checks Postgres for any `email_jobs` rows still marked `scheduled`, checks each one's actual state in BullMQ, and only re-enqueues jobs that are genuinely missing or lost — it deliberately does *not* blindly re-add every pending row, to avoid creating duplicate jobs for ones that are already safely queued.

### Concurrency, delay, and rate limiting
- **Concurrency:** configurable via `WORKER_CONCURRENCY` (default 5), passed directly to BullMQ's `Worker` options.
- **Minimum delay between sends:** configurable via `MIN_DELAY_MS` (default 2000ms), enforced using BullMQ's built-in `limiter` option on the worker (`max: 1` per `duration: MIN_DELAY_MS`).
- **Hourly rate limit:** configurable via `MAX_EMAILS_PER_HOUR_PER_SENDER` (default 200), enforced **per sender** using an atomic Redis `INCR` counter keyed as `rate:{senderId}:{YYYY-MM-DDTHH}`, with a 1-hour TTL set via `EXPIRE` on first increment. This is safe across multiple worker processes because Redis's `INCR` is atomic — no in-memory counters are used anywhere in the rate-limiting logic.

**When the hourly limit is hit:** the job is not failed or dropped. It's re-enqueued with a delay calculated to land at the start of the next hour window, using a new BullMQ job ID (`{originalJobId}-rl{retryCount}`, incrementing on each subsequent rate-limit hit) since the original ID has already been consumed by BullMQ. The database row's `bullmq_job_id` column is kept in sync so future reconciliation checks look at the correct, current job ID. The row's `status` remains `scheduled` throughout — it is genuinely still pending, just deferred.

This was verified by temporarily lowering `MAX_EMAILS_PER_HOUR_PER_SENDER` to 2 and scheduling 4 emails for the same sender: the first 2 sent normally, and the worker logged `Rate limit hit for sender ..., rescheduling job ... to <next-hour-timestamp>` for the remaining 2 — confirmed via direct SQL query showing 2 rows `sent` and 2 rows still `scheduled` with `scheduled_for` pushed into the next hour.

### Behavior under load (1000+ emails scheduled at once)
When bulk-scheduling via `POST /api/campaigns`, each recipient gets an individually delayed job, spaced `delayBetweenMs` apart starting from the requested `startTime` — so recipient #1 fires first, recipient #2 fires `delayBetweenMs` later, and so on, preserving send order naturally without any additional locking logic. On top of this, the hourly rate limiter still applies independently per send, so even a large burst of jobs hitting their delay at the same moment will self-throttle at the Redis counter, with excess volume automatically rolling into the next hour window rather than being dropped or failing.

## API Reference

```
POST /api/campaigns
  Body: { subject, body, senderId, delayBetweenMs, maxEmailsPerHour, startTime, createdBy, recipients: string[] }
  → { campaignId, emailsScheduled }

GET  /api/campaigns/:id
  → full campaign row

GET  /api/emails?status=scheduled|sent|failed&limit=&offset=
  → { jobs: [{ id, recipient_email, status, scheduled_for, sent_at, subject }] }

GET  /health
  → { status: "ok", db: "connected" }
```

## Features Implemented

**Backend**
- [x] Email scheduling via BullMQ delayed jobs (no cron, verified)
- [x] Persistent across server/worker restart (verified with real kill/restart test)
- [x] Idempotent sends — two independent layers (BullMQ jobId + DB status check)
- [x] Configurable worker concurrency
- [x] Configurable minimum delay between sends
- [x] Distributed-safe hourly rate limiting per sender (Redis INCR/EXPIRE, verified with real overflow test)
- [x] Rate-limited jobs are rescheduled to the next hour window, never dropped
- [x] DB-reconciliation on worker boot (re-enqueues genuinely lost jobs only)
- [x] Full REST API: create campaign, list scheduled/sent emails, get campaign detail

**Frontend**
- [x] Real Google OAuth login (NextAuth v5, no mock)
- [x] Session-protected dashboard, redirects unauthenticated users to `/login`
- [x] User name/email/avatar shown in sidebar from real session data
- [x] Logout
- [x] Scheduled/Sent tabs with live counts
- [x] Compose modal: subject, body, CSV upload with live recipient-count detection, removable recipient chips, delay-between-emails and hourly-limit inputs
- [x] Real-time table updates after scheduling a new campaign
- [x] Loading states and empty states on all data tables
- [x] Own color palette and typography (Inter, indigo primary accent, semantic status badges) — layout/UX follows the provided Figma closely, colors are original rather than copied

## Assumptions, Shortcuts, and Trade-offs

- **Per-sender SMTP credentials are stored but not yet used dynamically.** The `senders` table has `smtp_user`/`smtp_pass` columns per row, but the mailer currently sends through a single, globally-configured Ethereal transporter rather than building one per sender at send time. Sufficient for this assignment's single-test-sender scope; a small transporter-factory refactor would be needed for true multi-sender production use.
- **No automated test suite.** Every behavior described above (restart-persistence, rate-limit overflow, idempotency) was manually verified via real API calls and direct SQL/Redis inspection rather than unit/integration tests, given the assignment's 48-hour time constraint. Given more time, the rate limiter and reconciliation logic would be the first candidates for unit tests.
- **CSV parsing** uses `papaparse` on the frontend and filters rows to anything containing `@`, so header rows without an `@` symbol are automatically excluded from the recipient list.
- **The frontend's sender selection is hardcoded** to the single seeded Ethereal sender's UUID rather than offering a sender-management UI, since only one test sender exists for this assignment's scope.
- **Google OAuth runs in "Testing" mode** in Google Cloud Console (not published/verified), which is expected and sufficient for local development and demo purposes.
- **Email detail view** (clicking into a single email to see full thread-style content) was intentionally not built — the assignment's explicit requirement is a table/list view with Email/Subject/Time/Status columns, which is what's implemented.# ReachInbox Email Scheduler

A production-style email scheduling system built for the ReachInbox / Outbox Labs hiring assignment. Users log in with Google, compose an email (single recipient or bulk via CSV upload), schedule it for a future time, and the backend reliably delivers it via BullMQ delayed jobs — surviving restarts, respecting per-sender rate limits, and never double-sending.

## Tech Stack

**Backend:** TypeScript (strict mode), Express 5, BullMQ, Redis (ioredis), PostgreSQL (raw SQL via `pg`, no ORM), Nodemailer (Ethereal fake SMTP)
**Frontend:** Next.js (App Router), TypeScript, Tailwind CSS 4, NextAuth v5 (Google OAuth)
**Infra:** Docker Compose (Postgres + Redis)

## Project Structure

```
reachinbox-email-scheduler/
├── docker-compose.yml          # Postgres + Redis
├── backend/
│   └── src/
│       ├── config/env.ts       # env var loading + validation
│       ├── db/
│       │   ├── client.ts        # pg Pool
│       │   ├── schema.sql
│       │   └── campaignRepo.ts  # all typed DB queries
│       ├── queue/
│       │   ├── connection.ts     # ioredis connection
│       │   ├── emailQueue.ts      # BullMQ Queue
│       │   ├── worker.ts           # BullMQ Worker — send logic, rate limiting, idempotency
│       │   ├── rateLimiter.ts       # Redis-backed hourly counter per sender
│       │   └── reconcile.ts          # DB-reconciliation on worker boot
│       ├── routes/
│       │   ├── campaigns.ts          # POST /api/campaigns, GET /api/campaigns/:id
│       │   └── emails.ts              # GET /api/emails?status=
│       ├── services/mailer.ts          # nodemailer + Ethereal
│       └── server.ts                    # Express app
└── frontend/
    ├── auth.ts                          # NextAuth Google provider config
    ├── app/
    │   ├── page.tsx                      # session check + redirect
    │   ├── login/page.tsx                 # login screen
    │   └── api/auth/[...nextauth]/route.ts
    ├── components/
    │   ├── Dashboard.tsx                   # main dashboard logic
    │   ├── Sidebar.tsx
    │   ├── EmailTable.tsx
    │   ├── ComposeModal.tsx
    │   └── ui/                              # Button, Badge, Input, EmptyState, Spinner
    └── lib/apiClient.ts                      # typed backend fetch wrapper
```

## Setup

### 1. Start infrastructure
```bash
docker compose up -d
```
This starts Postgres and Redis. Note: in this project's dev environment, Postgres is mapped to host port **5433** (not 5432), to avoid a local port conflict — adjust `docker-compose.yml` and connection strings if 5432 is free on your machine.

### 2. Apply the database schema
```bash
docker cp backend/src/db/schema.sql reachinbox-postgres:/schema.sql
docker exec -it reachinbox-postgres psql -U reachinbox -d reachinbox -f /schema.sql
```

### 3. Backend setup
```bash
cd backend
npm install
```

Create `backend/.env` (see `.env.example`):
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

Generate a free Ethereal test SMTP account at [ethereal.email](https://ethereal.email) — click "Create Ethereal Account" and copy the generated username/password into the env vars above.

Seed one sender row (used by the frontend's compose form):
```bash
docker exec -it reachinbox-postgres psql -U reachinbox -d reachinbox -c "INSERT INTO senders (name, smtp_user, smtp_pass) VALUES ('Ethereal Test Sender', '<your-ethereal-username>', '<your-ethereal-password>') RETURNING *;"
```
Copy the returned `id` — you'll need it as the `senderId` used by the frontend's compose flow (currently hardcoded there, see Trade-offs below).

Run the API server and the worker in **two separate terminals**:
```bash
npm run dev                      # Express API, port 4000
npx tsx src/queue/worker.ts       # BullMQ worker
```

### 4. Frontend setup
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

Create Google OAuth credentials at [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth Client ID → Web application, with:
- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

Run the frontend:
```bash
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/login`.

## Architecture

### No cron — BullMQ delayed jobs only
Every scheduled email becomes a BullMQ job with a `delay` computed from `scheduledFor - now()`. BullMQ persists this in Redis, so the job exists independently of any running process. There is no polling loop, OS crontab, or cron library anywhere in the system.

### Idempotency (two layers)
1. **Queue-level:** each `email_jobs` row's Postgres `id` (UUID) is reused directly as the BullMQ job ID. BullMQ refuses to enqueue a duplicate job with the same ID — this is the first guard.
2. **Application-level:** before actually sending, the worker independently checks the job's current DB `status`. If it's already `sent`, the worker skips the send entirely, even if it were somehow triggered twice (for example, a theoretical race between a rate-limit reschedule and the boot-time reconciliation both touching the same job). This means idempotency doesn't rely on BullMQ alone — the database is the final source of truth.

### Restart survival
The record of pending sends lives entirely in Redis (BullMQ's delayed job timers) and Postgres (`email_jobs` rows) — never in the worker process's own memory. Killing and restarting the worker mid-wait has no effect on correctness: BullMQ's delayed-job timer keeps counting down in Redis regardless of whether a worker is currently listening.

This was verified manually and repeatedly during development: a campaign was scheduled via the real API, the worker process was fully killed (`Ctrl+C`), left off for 10-15+ seconds, then restarted fresh — the email still sent automatically at the correct time, confirmed via direct SQL query to show exactly one `sent` row with no duplicates.

As a second layer of defense (for the harder case — what if Redis itself lost data, not just the process restarting), a `reconcileOnBoot()` step runs every time the worker starts: it checks Postgres for any `email_jobs` rows still marked `scheduled`, checks each one's actual state in BullMQ, and only re-enqueues jobs that are genuinely missing or lost — it deliberately does *not* blindly re-add every pending row, to avoid creating duplicate jobs for ones that are already safely queued.

### Concurrency, delay, and rate limiting
- **Concurrency:** configurable via `WORKER_CONCURRENCY` (default 5), passed directly to BullMQ's `Worker` options.
- **Minimum delay between sends:** configurable via `MIN_DELAY_MS` (default 2000ms), enforced using BullMQ's built-in `limiter` option on the worker (`max: 1` per `duration: MIN_DELAY_MS`).
- **Hourly rate limit:** configurable via `MAX_EMAILS_PER_HOUR_PER_SENDER` (default 200), enforced **per sender** using an atomic Redis `INCR` counter keyed as `rate:{senderId}:{YYYY-MM-DDTHH}`, with a 1-hour TTL set via `EXPIRE` on first increment. This is safe across multiple worker processes because Redis's `INCR` is atomic — no in-memory counters are used anywhere in the rate-limiting logic.

**When the hourly limit is hit:** the job is not failed or dropped. It's re-enqueued with a delay calculated to land at the start of the next hour window, using a new BullMQ job ID (`{originalJobId}-rl{retryCount}`, incrementing on each subsequent rate-limit hit) since the original ID has already been consumed by BullMQ. The database row's `bullmq_job_id` column is kept in sync so future reconciliation checks look at the correct, current job ID. The row's `status` remains `scheduled` throughout — it is genuinely still pending, just deferred.

This was verified by temporarily lowering `MAX_EMAILS_PER_HOUR_PER_SENDER` to 2 and scheduling 4 emails for the same sender: the first 2 sent normally, and the worker logged `Rate limit hit for sender ..., rescheduling job ... to <next-hour-timestamp>` for the remaining 2 — confirmed via direct SQL query showing 2 rows `sent` and 2 rows still `scheduled` with `scheduled_for` pushed into the next hour.

### Behavior under load (1000+ emails scheduled at once)
When bulk-scheduling via `POST /api/campaigns`, each recipient gets an individually delayed job, spaced `delayBetweenMs` apart starting from the requested `startTime` — so recipient #1 fires first, recipient #2 fires `delayBetweenMs` later, and so on, preserving send order naturally without any additional locking logic. On top of this, the hourly rate limiter still applies independently per send, so even a large burst of jobs hitting their delay at the same moment will self-throttle at the Redis counter, with excess volume automatically rolling into the next hour window rather than being dropped or failing.

## API Reference

```
POST /api/campaigns
  Body: { subject, body, senderId, delayBetweenMs, maxEmailsPerHour, startTime, createdBy, recipients: string[] }
  → { campaignId, emailsScheduled }

GET  /api/campaigns/:id
  → full campaign row

GET  /api/emails?status=scheduled|sent|failed&limit=&offset=
  → { jobs: [{ id, recipient_email, status, scheduled_for, sent_at, subject }] }

GET  /health
  → { status: "ok", db: "connected" }
```

## Features Implemented

**Backend**
- [x] Email scheduling via BullMQ delayed jobs (no cron, verified)
- [x] Persistent across server/worker restart (verified with real kill/restart test)
- [x] Idempotent sends — two independent layers (BullMQ jobId + DB status check)
- [x] Configurable worker concurrency
- [x] Configurable minimum delay between sends
- [x] Distributed-safe hourly rate limiting per sender (Redis INCR/EXPIRE, verified with real overflow test)
- [x] Rate-limited jobs are rescheduled to the next hour window, never dropped
- [x] DB-reconciliation on worker boot (re-enqueues genuinely lost jobs only)
- [x] Full REST API: create campaign, list scheduled/sent emails, get campaign detail

**Frontend**
- [x] Real Google OAuth login (NextAuth v5, no mock)
- [x] Session-protected dashboard, redirects unauthenticated users to `/login`
- [x] User name/email/avatar shown in sidebar from real session data
- [x] Logout
- [x] Scheduled/Sent tabs with live counts
- [x] Compose modal: subject, body, CSV upload with live recipient-count detection, removable recipient chips, delay-between-emails and hourly-limit inputs
- [x] Real-time table updates after scheduling a new campaign
- [x] Loading states and empty states on all data tables
- [x] Own color palette and typography (Inter, indigo primary accent, semantic status badges) — layout/UX follows the provided Figma closely, colors are original rather than copied

## Assumptions, Shortcuts, and Trade-offs

- **Per-sender SMTP credentials are stored but not yet used dynamically.** The `senders` table has `smtp_user`/`smtp_pass` columns per row, but the mailer currently sends through a single, globally-configured Ethereal transporter rather than building one per sender at send time. Sufficient for this assignment's single-test-sender scope; a small transporter-factory refactor would be needed for true multi-sender production use.
- **No automated test suite.** Every behavior described above (restart-persistence, rate-limit overflow, idempotency) was manually verified via real API calls and direct SQL/Redis inspection rather than unit/integration tests, given the assignment's 48-hour time constraint. Given more time, the rate limiter and reconciliation logic would be the first candidates for unit tests.
- **CSV parsing** uses `papaparse` on the frontend and filters rows to anything containing `@`, so header rows without an `@` symbol are automatically excluded from the recipient list.
- **The frontend's sender selection is hardcoded** to the single seeded Ethereal sender's UUID rather than offering a sender-management UI, since only one test sender exists for this assignment's scope.
- **Google OAuth runs in "Testing" mode** in Google Cloud Console (not published/verified), which is expected and sufficient for local development and demo purposes.
- **Email detail view** (clicking into a single email to see full thread-style content) was intentionally not built — the assignment's explicit requirement is a table/list view with Email/Subject/Time/Status columns, which is what's implemented.