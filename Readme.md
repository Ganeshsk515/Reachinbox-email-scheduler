Full stack email job scheduler built Typescript,Express,BullMQ,Redis and Postgres.x# Outbox Assessment — Email Job Scheduler

A production-style email scheduling system built for the ReachInbox hiring assignment. Users log in with Google, compose an email (single recipient or bulk via CSV upload), schedule it for a future time, and the backend reliably delivers it via BullMQ delayed jobs — surviving restarts, respecting rate limits, and never double-sending.

## Tech Stack

**Backend:** TypeScript, Express.js, BullMQ, Redis, PostgreSQL, Prisma, Nodemailer (Ethereal SMTP)
**Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, NextAuth (Google OAuth)
**Infra:** Docker Compose (Postgres + Redis)

## Project Structure

```
OutboxAssessment/
├── docker-compose.yml       # Postgres + Redis
├── backend/
│   ├── prisma/schema.prisma # DB schema
│   └── src/
│       ├── index.ts         # Express API routes
│       ├── worker.ts        # BullMQ worker — sending, concurrency, rate limiting
│       └── lib/
│           ├── prisma.ts    # Prisma client singleton
│           └── queue.ts     # BullMQ queue + Redis connection
└── frontend/
    ├── auth.ts              # NextAuth Google provider config
    └── app/
        ├── page.tsx         # Login screen
        ├── dashboard/page.tsx
        └── components/ComposeModal.tsx
```

## Setup

1. `docker compose up -d` — starts Postgres and Redis
2. `cd backend && npm install && npx prisma migrate dev`
3. Copy `.env.example` to `.env` in `backend/` and fill in Google OAuth credentials
4. `cd frontend && npm install`, create `.env.local` with `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `NEXT_PUBLIC_API_URL=http://localhost:4000`
5. Run all three processes in separate terminals:
   - `cd backend && npm run dev` (API, port 4000)
   - `cd backend && npm run worker` (email worker)
   - `cd frontend && npm run dev` (dashboard, port 3000)

Ethereal SMTP accounts (fake, for testing) are seeded manually into the `Sender` table via Prisma Studio — generate accounts at [ethereal.email](https://ethereal.email).

## Design Decisions

### No cron — BullMQ delayed jobs only
Every scheduled email becomes a BullMQ job with a `delay` computed from `scheduledAt - now()`. BullMQ persists this in Redis, so the job exists independently of any running process. There is no polling loop or cron trigger anywhere in the system.

### Idempotency
Each `EmailJob` row's database `id` is reused as the BullMQ job ID. BullMQ refuses to enqueue a duplicate job ID, which is the first layer of protection. The second layer is inside the worker itself: before sending, it checks the job's current DB `status` — if it's already `sent`, the worker skips it immediately, even if it were somehow triggered twice. This means idempotency doesn't rely on BullMQ alone; the database is the source of truth.

### Restart survival
The "todo list" of pending sends lives entirely in Redis (BullMQ) and Postgres (`EmailJob` rows) — never in the worker process's memory. Killing and restarting the worker mid-wait has no effect: BullMQ's delayed-job timer continues counting down in Redis regardless of whether a worker is listening. This was verified manually: a job was scheduled, the worker was killed, left off for over a minute, then restarted — the email still sent at the exact original scheduled time, with no duplication and no data loss.

### Concurrency, delay, and rate limiting
- **Concurrency**: configurable via `WORKER_CONCURRENCY` (default 5), passed directly to BullMQ's `Worker` options.
- **Minimum delay between sends**: configurable via `MIN_DELAY_SECONDS` (default 2), enforced with a `setTimeout` inside the worker before each send.
- **Hourly rate limit**: configurable via `MAX_EMAILS_PER_HOUR` (default 200), enforced **per sender** using an atomic Redis `INCR` counter keyed by `rate:{senderId}:{hourWindow}`, with a 1-hour TTL. This is safe across multiple worker processes because Redis `INCR` is atomic — no in-memory counters are used anywhere.

**When the hourly limit is hit:** the job is not failed or dropped. Its status is set to `rescheduled` and it's re-enqueued with a fresh delay that lands in the next hour window, using a new BullMQ job ID (since the original ID is already consumed). This satisfies the requirement that jobs are delayed rather than dropped under load.

### Behavior under load (1000+ emails at the same time)
When bulk-scheduling via `/emails/schedule-bulk`, each recipient gets an individually delayed job, spaced `delaySeconds` apart starting from the requested start time — so recipient #1 fires first, recipient #2 fires `delaySeconds` later, and so on, preserving order naturally without any extra locking logic. On top of this, the hourly rate limiter still applies per send, so even a burst of 1000 jobs hitting their delay at once will self-throttle at the Redis counter and roll excess volume into the next hour window automatically.

### Trade-offs
- Ethereal SMTP is fake/test-only — there's no real inbox delivery, by design (per the assignment).
- The hourly rate limit is enforced per-sender, not globally; a global limit could be added by keying the Redis counter on a constant instead of `senderId` if needed.
- CSV/text parsing on the frontend uses a simple regex extraction rather than a dedicated CSV parser library, since lead lists in this context are just flat email addresses, not structured multi-column data.
- Google OAuth runs in "Testing" mode in Google Cloud Console (not published), so only allow-listed test users can log in — sufficient for this assignment's scope.

## Verified Behaviors

- ✅ Real Google OAuth login (no mock), user synced to DB on login
- ✅ Scheduling via both single-email and bulk/CSV upload flows
- ✅ Idempotent sends (checked at both BullMQ and DB level)
- ✅ Restart survival (manually tested — job fired at correct time after a worker restart)
- ✅ Hourly rate limiting reschedules rather than drops jobs
- ✅ Dashboard reflects live Scheduled/Sent state with correct empty and loading states
