# ReachInbox Email Scheduler

A full-stack email scheduling system built for the ReachInbox / Outbox Labs hiring assignment. Users sign in with Google, upload recipients, compose an email, choose a future start time, and schedule delivery through persistent BullMQ delayed jobs.

## Live deployment

- Frontend: https://frontend-eight-coral-44.vercel.app
- API health: https://api-production-594b.up.railway.app/health

The frontend is deployed on Vercel. The API, BullMQ worker, PostgreSQL, and Redis are deployed as separate Railway services.

## Stack

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, Auth.js / NextAuth Google OAuth
- Backend: Express 5, TypeScript, BullMQ, ioredis, PostgreSQL (`pg`), Nodemailer
- Infrastructure: Redis and PostgreSQL locally with Docker Compose; Railway in the hosted environment
- Email testing: Ethereal SMTP

## Features

### Backend

- Delayed email jobs implemented with BullMQ; no cron jobs.
- One Postgres `email_jobs` record per recipient, used as the source of truth.
- BullMQ job IDs reuse the database job UUID for queue-level idempotency.
- Database status is checked before SMTP delivery for a second idempotency guard.
- Configurable worker concurrency and minimum send interval.
- Distributed, per-sender hourly rate limit using atomic Redis `INCR` and expiry.
- Rate-limited jobs are rescheduled to the next hour instead of being dropped.
- Worker startup reconciliation restores genuinely missing queued jobs from scheduled database rows.
- SMTP connection, greeting, and socket timeouts prevent indefinitely stuck delivery attempts.

### Frontend

- Real Google OAuth login and logout.
- Session-protected dashboard with the signed-in user's name, email, and avatar.
- Scheduled and Sent inbox-style lists with counts, loading states, empty states, and status badges.
- Full-page compose experience with subject, body, future start time, CSV/text upload, removable recipient chips, delay, and hourly-limit controls.
- Client-side request timeout and toast feedback for scheduling errors.

## Architecture

```text
Next.js dashboard
       |
       v
Express API ----> PostgreSQL (campaigns, senders, email_jobs)
       |
       v
BullMQ Queue ----> Redis (delayed jobs, rate counters)
       |
       v
Dedicated Worker ----> Ethereal SMTP
```

When a campaign is created, the API persists its campaign and per-recipient jobs in Postgres, then adds a BullMQ delayed job for each recipient. Jobs are delayed by `startTime + recipientIndex * delayBetweenMs`.

Pending delayed jobs survive API and worker restarts because their queue state lives in Redis. The worker's boot reconciliation compares scheduled database jobs against the queue and re-adds only missing jobs. A worker restart is the recommended restart-persistence demo because it exercises the service that performs delivery.

## Local setup

### 1. Start Redis and PostgreSQL

```bash
docker compose up -d
```

PostgreSQL is exposed locally on port `5433`; Redis uses `6379`.

### 2. Configure the backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=4000
DATABASE_URL=postgresql://reachinbox:reachinbox_dev_password@localhost:5433/reachinbox
REDIS_HOST=localhost
REDIS_PORT=6379
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=<ethereal-user>
ETHEREAL_PASS=<ethereal-password>
WORKER_CONCURRENCY=5
MIN_DELAY_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200
```

Create an Ethereal account at https://ethereal.email and use its SMTP credentials.

Start the API and worker in separate terminals:

```bash
npm run dev
npx tsx src/queue/worker.ts
```

The API initializes the schema at startup. The worker seeds the configured demo sender when it starts.

### 3. Configure the frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
AUTH_SECRET=<random-secret>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
NEXT_PUBLIC_API_URL=http://localhost:4000
```

For local Google OAuth, configure:

```text
Authorized JavaScript origin: http://localhost:3000
Authorized redirect URI: http://localhost:3000/api/auth/callback/google
```

Run the frontend:

```bash
npm run dev
```

## API

```text
POST /api/campaigns
GET  /api/campaigns/:id
GET  /api/emails?status=scheduled|sent|failed&limit=&offset=
GET  /health
```

Example campaign request:

```json
{
  "subject": "Demo campaign",
  "body": "Scheduled through BullMQ.",
  "senderId": "cd07bb53-c67e-4e31-8975-e3ba6d0f078c",
  "delayBetweenMs": 2000,
  "maxEmailsPerHour": 100,
  "startTime": "2026-08-21T15:00:00.000Z",
  "recipients": ["demo@example.com"]
}
```

## Testing

```bash
cd backend
npm run build
npm test

cd ../frontend
npm run lint
npm run build
```

`demo-recipients-500.csv` provides 500 safe `example.com` addresses for CSV parsing and load demonstrations. Use a small recipient list for a live SMTP demo to avoid unnecessary queued work.

## Trade-offs

- The UI is intentionally scoped to a single seeded Ethereal sender; sender management is not exposed.
- Google OAuth is intended for local/demo use and requires configured test users while the Google consent screen remains in Testing mode.
- The project uses Ethereal fake SMTP as required by the assignment, rather than a transactional-email provider.
- A detail/thread view is intentionally out of scope; the assignment requires scheduled and sent list views.
