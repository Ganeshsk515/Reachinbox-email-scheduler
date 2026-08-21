# PROGRESS.md — ReachInbox Email Scheduler (Hiring Assignment)

> **Purpose of this file:** This is a complete state snapshot of the project. If you are an AI assistant reading this for the first time, you should be able to understand the entire project — what it is, why every decision was made, what's built, what's tested, what's broken, and exactly what to do next — without the user re-explaining anything. Read this whole file before responding to any request in this project.

---

## 1. What this project actually is

This is a **take-home hiring assignment** for a Software Development Intern role at **ReachInbox.ai** (product of Outbox Labs). The user has already been shortlisted and has **48 hours** to complete it. The full original assignment text is preserved in `reachinbox-blueprint.md` (see below) — read that for the complete requirements if anything here is ambiguous.

**One-line summary of the task:** Build a production-grade email scheduler service (backend) + dashboard (frontend) that schedules emails using BullMQ delayed jobs (NOT cron), sends via Ethereal fake SMTP, survives server restarts without duplicating or losing jobs, and enforces configurable rate limits per sender per hour.

**Grading priorities, in order (this matters for prioritization):**
1. Restart-persistence — does a scheduled email still send correctly after the server/worker is killed and restarted, with no duplicates?
2. Distributed-safe rate limiting — is the hourly cap enforced via Redis/DB counters, not in-memory state?
3. Idempotency — no email ever sent twice for the same job
4. Code structure / cleanliness — would a senior engineer want to inherit this codebase?
5. README quality — can a reviewer understand the architecture in 3 minutes without reading code?
6. Frontend polish and Figma fidelity — real requirement, but weighted below backend correctness

**Hard constraints (non-negotiable, explicitly graded against):**
- No cron jobs of any kind (no `node-cron`, no OS crontab, no `agenda`)
- Scheduling must use BullMQ delayed jobs
- Must survive restart: future jobs still fire at correct time, no re-sends from scratch
- No duplicate sends — idempotency is mandatory

**Anti-plagiarism context:** The user has explicitly asked to keep this project "as human as possible." They are aware AI is being used to build this (this conversation), which is fine — the actual plagiarism risk they're worried about is (a) looking suspiciously similar to another candidate's submission for this same recurring assignment, and (b) submitting something they can't personally explain. Practical implications for any AI helping on this project:
- Prefer commit-by-commit incremental progress over big code dumps, to keep git history authentic
- Where reasonable, let the user write logic themselves (with guidance) rather than always pasting finished code, especially for the "core" logic (rate limiter, worker processing logic, idempotency handling) — though pure boilerplate (configs, wiring) is fine to hand over directly
- Don't reference or imply awareness of other candidates' solutions to this assignment

---

## 2. Company/assignment context (from the original brief)

ReachInbox.ai is an AI-driven cold email outreach platform (find/enrich/engage leads, personalized sequences). This assignment is a "tiny slice" of what their real system does — reliable scheduling and sending of emails at scale.

**Submission requirements (not yet started, keep in mind for later):**
- Private GitHub repo — already created: `https://github.com/Ganeshsk515/Reachinbox-email-scheduler`
- Collaborators to add: `Mitrajit` and `Yadav036` — **user should confirm this was actually done**, it was instructed early on but never explicitly re-confirmed in this conversation
- README with setup instructions + architecture overview + feature checklist
- Demo video (max 5 min): compose → dashboard → restart proof → rate-limit/delay under load (bonus)
- Fill out submission form: https://forms.clickup.com/9005062261/f/8cbwp3n-8876/6NNNJ92DV93PQTAYST
- Note assumptions/shortcuts/trade-offs made

**Figma link (for frontend, not yet used):**
`https://www.figma.com/design/kOTwGlESjijCYnMgtHfvfU/Outbox-Labs-Assignment?node-id=59-4050&p=f`
This could not be fetched by AI tools (Figma blocks automated/robot access) — the user must open it manually and reference it while building frontend components. Not yet reviewed or broken into a component plan.

---

## 3. Tech stack (locked in — do not change without strong reason)

| Layer | Choice | Notes |
|---|---|---|
| Backend language | TypeScript, `strict: true` | Assignment explicitly requires backend be TypeScript |
| Backend framework | Express 5 (`^5.2.1`) | Note: v5, not v4 — async route handlers auto-catch rejected promises, differs from older SO answers |
| Dev runtime | `tsx watch` | Not `ts-node-dev` |
| Queue | BullMQ (`^6.1.2`) + Redis (via `ioredis@6.0.0`) | No cron, per hard constraint |
| Database | PostgreSQL 16 (alpine, Docker) | Raw SQL via `pg` package, no ORM used |
| Email | Ethereal (fake SMTP) via `nodemailer` | Test/disposable account, see credentials below |
| Frontend | Next.js + NextAuth (Google OAuth) + Tailwind — **planned, not started** | |
| Infra | Docker Compose (Redis + Postgres) | |

**Repo:** `reachinbox-email-scheduler` (GitHub: `Ganeshsk515/Reachinbox-email-scheduler`), private.

---

## 4. Environment-specific facts (machine gotchas — do NOT re-debug these, just use them)

- **User is on Windows, using PowerShell.** Commands must be PowerShell-compatible, not bash/zsh. `curl` in PowerShell aliases to `Invoke-WebRequest` and behaves differently from real curl — use `Invoke-RestMethod` with a `ConvertTo-Json` body instead for API testing.
- **Postgres runs on host port 5433, NOT 5432.** Port 5432 was already occupied by an unrelated old project's container (`rpg-portfolio-db-1`, from a different project called `rpg-portfolio`). `docker-compose.yml` maps `5433:5432`. `DATABASE_URL` in `.env` must use `5433`.
- Redis runs on default port 6379, no conflicts there.
- **The single most recurring mistake in this project:** running `npx tsx src/...` commands from the repo root instead of from `backend/`. Always `cd` into `backend/` first before any `npx tsx` or `npm run` command.
- The user's repo lives at: `C:\Users\gouri\OneDrive\Desktop\reachinbox-email-scheduler`
- Editing files by pasting multi-line content: be careful the user doesn't literally paste PowerShell here-string syntax (`@'...'@ | Out-File`) into the file content itself in VS Code — this happened once and corrupted `server.ts` with literal `@'` as text. Always double check file content with `Get-Content <path>` after edits before running anything.
- **Running the full stack requires 3 terminals simultaneously, left open:**
  1. `npm run dev` (Express server) — run from `backend/`
  2. `npx tsx src/queue/worker.ts` (BullMQ worker) — run from `backend/`
  3. A free terminal for testing commands / git / psql checks

**Ethereal test account (disposable, already in `backend/.env`):**
```
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=hildegard.kihn59@ethereal.email
ETHEREAL_PASS=5Jy56NqNKSEysRXwVS
```
Note: nodemailer's `from` field MUST use the object form `{ name: "...", address: env.etherealUser }`, NOT a hand-built template string like `"Name" <email>` — the latter caused a `501 Bad sender address syntax` error from Ethereal's SMTP server for reasons not fully root-caused (suspected hidden encoding issue in the template literal), the object form fixed it reliably and is the more correct pattern anyway.

**Existing DB seed data:**
One row exists in the `senders` table:
```
id: cd07bb53-c67e-4e31-8975-e3ba6d0f078c
name: Ethereal Test Sender
smtp_user: hildegard.kihn59@ethereal.email
```
Use this `senderId` for all test campaign creation going forward. (Note: `smtp_pass` is stored per-sender in the DB but the app currently sends via the single global Ethereal transporter in `mailer.ts` — this is a known simplification, see Section 7.)

---

## 5. Database schema (as currently applied)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  smtp_user TEXT NOT NULL,
  smtp_pass TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sender_id UUID REFERENCES senders(id),
  delay_between_ms INT NOT NULL,
  max_emails_per_hour INT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE email_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',   -- 'scheduled' | 'sent' | 'failed'
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  bullmq_job_id TEXT,          -- currently unused; email_jobs.id itself IS the BullMQ jobId
  attempts INT DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (campaign_id, recipient_email)
);

CREATE INDEX idx_email_jobs_status ON email_jobs(status);
CREATE INDEX idx_email_jobs_scheduled_for ON email_jobs(scheduled_for);
```

File location: `backend/src/db/schema.sql`

**Idempotency design:** `email_jobs.id` (Postgres UUID) is used directly as BullMQ's `jobId` when enqueueing. BullMQ deduplicates jobs with the same `jobId` automatically — this is the core idempotency mechanism, already proven working (see Section 6, Step 9).

---

## 6. What's built and VERIFIED working (each item below was actually tested, not just written)

### Step 1 — Repo + git
- Private repo created, pushed, clean incremental commit history maintained throughout
- **UNCONFIRMED**: collaborators `Mitrajit` and `Yadav036` were instructed to be added early on but never explicitly re-confirmed by the user. **Double-check this before submission.**

### Step 2 — Docker infra
- `docker-compose.yml` at repo root: Redis (6379) + Postgres (5433→5432), both verified reachable

### Step 3 — Database schema
- Schema applied and verified via `\dt` (three tables confirmed present)

### Step 4 — Express + TypeScript server
- `backend/src/server.ts` — health check route (`GET /health`) confirms DB connectivity
- `tsconfig.json` has `strict: true`
- Verified: `curl`/browser hit to `/health` returns `{"status":"ok","db":"connected"}`

### Step 5 — BullMQ + Redis (standalone proof)
- `backend/src/queue/connection.ts` — ioredis connection (`redisConnection`)
- `backend/src/queue/emailQueue.ts` — BullMQ Queue instance
- Verified: a delayed job (10s delay) fired at the correct time via a temporary test script (since deleted)

### Step 6 — Ethereal email sending (standalone proof)
- `backend/src/services/mailer.ts` — nodemailer transporter + `sendTestEmail()` function
- Verified: real email sent, Ethereal preview URL rendered correctly

### Step 7 — Worker wired to actually send email
- `backend/src/queue/worker.ts` — BullMQ Worker that calls `sendTestEmail` on job processing
- Verified: full chain queue → delay → worker → Ethereal send, confirmed via console logs and Ethereal preview URL

### Step 8 — Campaigns/email_jobs wired into Postgres (CORE FEATURE — fully proven)
- `backend/src/db/campaignRepo.ts` — typed query layer: `createCampaign`, `createEmailJob`, `markEmailJobSent`, `markEmailJobFailed`, `getEmailJobById`
- `backend/src/routes/campaigns.ts` — `POST /api/campaigns` route: accepts `{ subject, body, senderId, delayBetweenMs, maxEmailsPerHour, startTime, createdBy, recipients: string[] }`, writes campaign + one email_job row per recipient, enqueues one BullMQ job per recipient using `email_jobs.id` as `jobId`
- `worker.ts` updated to call `markEmailJobSent`/`markEmailJobFailed` after processing (previously only logged to console)
- **Verified end-to-end**: POST request → DB rows created with `status: scheduled` → BullMQ jobs fire after their computed delay → Ethereal sends → DB rows updated to `status: sent` with real `sent_at` timestamps. Confirmed via direct SQL query showing both test rows as `sent`.

### Step 9 — Restart / persistence proof (CRITICAL REQUIREMENT — fully proven)
**This was tested rigorously and is your strongest evidence for the demo video:**
1. Scheduled a real campaign via API with `startTime` ~2 minutes in the future
2. Confirmed via SQL that the `email_jobs` row was `status: scheduled` before doing anything
3. Fully killed the worker process (`Ctrl+C`, confirmed terminated)
4. Waited ~10-15 seconds with worker completely down (job sitting untouched in Redis)
5. Restarted the worker fresh
6. Job fired automatically at the correct time with no manual re-trigger, email sent successfully
7. Confirmed via SQL: **exactly one row**, `status: sent` — no duplicates, no data loss

**What this proves:** Redis's own persistence (independent of the Node process) correctly retains delayed jobs across a full worker restart, and idempotency via `jobId` is functioning (though not stress-tested against an actual duplicate-request scenario yet — see Section 7 gaps).

### Step 10 — Rate limiting (IN PROGRESS — code written, NOT YET CONFIRMED APPLIED OR TESTED)
This is the current, unfinished step. The following code has been written and given to the user, but as of this file's last update, has not yet been confirmed applied or tested:

1. **`backend/src/queue/rateLimiter.ts`** (new file) — two functions:
   - `tryConsumeRateLimit(senderId: string): Promise<boolean>` — Redis `INCR`/`EXPIRE` on key `rate:{senderId}:{YYYY-MM-DDTHH}`, compares against `env.maxEmailsPerHourPerSender`
   - `getStartOfNextHour(): Date` — returns Date object for top of next hour

2. **`backend/src/config/env.ts`** — needs `maxEmailsPerHourPerSender: Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? 200)` added to the exported `env` object

3. **`.env` / `.env.example`** — need these three new vars added:
   ```
   WORKER_CONCURRENCY=5
   MIN_DELAY_MS=2000
   MAX_EMAILS_PER_HOUR_PER_SENDER=200
   ```

4. **`backend/src/queue/worker.ts`** — needs updating to:
   - Add `concurrency` and `limiter` (max:1, duration: MIN_DELAY_MS) options to the `Worker` constructor
   - Call `tryConsumeRateLimit(senderId)` before sending; if `false`, re-enqueue the SAME job (same `jobId`, so it stays idempotent) with a `delay` calculated from `getStartOfNextHour()`, and `return` early (do NOT throw/fail the job)

5. **`backend/src/routes/campaigns.ts`** — needs the `emailQueue.add(...)` call updated to include `senderId` in the job data payload (currently only passes `emailJobId, to, subject, body` — worker's rate limiter needs `senderId` to key the Redis counter correctly)

**STATUS UNCLEAR:** The user was asked to confirm these edits were made but the conversation moved to updating this progress file before confirmation was given. **The very next thing to do is confirm whether these 5 file edits were actually applied, then test them.**

---

## 7. Known gaps / things NOT yet built (be explicit about these — don't assume they exist)

- **DB-reconciliation-on-boot** — the "what if Redis itself loses its data, not just the Node process" scenario. Not built. This was flagged in the original blueprint as an impressive bonus (`reconcileJobs()` function that runs on server startup, checks DB for `scheduled`/`queued` jobs not present in BullMQ, and re-enqueues them). Should be built if time allows — it's cheap to implement given `campaignRepo.ts` already has the needed query functions.
- **Rate limiting is written but unverified** — see Section 6, Step 10 above. No test has been run yet with a deliberately low limit to observe the "reschedule to next hour" behavior actually firing.
- **`GET` list routes** — `/api/emails?status=scheduled` and `/api/emails?status=sent` (for the frontend tables) don't exist yet.
- **`GET /api/campaigns/:id`** — campaign detail route doesn't exist yet.
- **Auth routes** — `/api/auth/google/callback`, `/api/me`, `/api/auth/logout` — nothing started, no NextAuth setup yet.
- **Entire frontend** — nothing started. Next.js project not even scaffolded yet.
- **Per-sender SMTP credentials aren't actually used dynamically** — `senders` table stores `smtp_user`/`smtp_pass` per row, but `mailer.ts`'s `transporter` is currently a single hardcoded Ethereal transporter built from `.env` values, not built dynamically per-sender from the DB row. This is fine for the assignment (single Ethereal test sender is enough to demonstrate the concept) but worth a one-line mention in the README's "assumptions/shortcuts" section.
- **No automated tests** (unit/integration) — everything has been manually verified via scripts and curl/Postman-equivalent requests. Given the 48-hour constraint this is a reasonable and expected trade-off, but worth noting in the README.
- **Collaborators on GitHub repo** — instructed early, never re-confirmed. CHECK THIS.
- **Figma not yet reviewed** — link is known but the user hasn't extracted a color palette / component breakdown / Dev Mode inspection yet.

---

## 8. Exact next steps, in order (pick up here)

1. **Confirm Step 10's five file edits are actually applied** (see Section 6 above for the exact list: `rateLimiter.ts`, `env.ts`, `.env`/`.env.example`, `worker.ts`, `campaigns.ts`). Use `Get-Content` on each file to verify before assuming.
2. **Test rate limiting deliberately**: temporarily set `MAX_EMAILS_PER_HOUR_PER_SENDER=3` (or similar low number) in `.env`, restart server+worker, POST a campaign with 5+ recipients for the same sender, and confirm in worker logs that jobs beyond the limit get the `"Rate limit hit... rescheduling"` message rather than sending immediately. Then confirm in DB that those jobs are still `status: scheduled` (not sent), with a `scheduled_for` pushed into the next hour. Reset `MAX_EMAILS_PER_HOUR_PER_SENDER` back to 200 afterward.
3. **Build DB-reconciliation-on-boot** (Section 7 gap) — a `reconcileJobs()` function run at server startup that re-enqueues any DB rows with `status IN ('scheduled')` that aren't currently present in BullMQ. This directly strengthens the restart-persistence story for the README/demo.
4. **Build remaining GET routes**: `/api/emails?status=scheduled`, `/api/emails?status=sent` (paginated), `/api/campaigns/:id`.
5. **Clean up test artifacts**: remove any throwaway test scripts, clear test rows from `email_jobs`/`campaigns` tables before final demo recording.
6. **Start frontend**: review Figma (Dev Mode, extract colors/spacing/typography), scaffold Next.js app, set up NextAuth + Google OAuth, build reusable UI primitives (Button, Table, Modal, EmptyState, Spinner), then build pages (dashboard, compose modal with CSV upload, scheduled/sent tables).
7. **Write the README** (architecture overview, setup instructions, feature checklist, assumptions/trade-offs — use Section 7 of this file as the trade-offs list).
8. **Record demo video** (max 5 min): compose flow → dashboard tables → restart proof (re-run the exact Step 9 sequence on camera) → bonus: rate-limit-under-load demonstration.
9. **Confirm GitHub collaborators added**, fill out the ClickUp submission form.

For full architecture rationale (why BullMQ over cron, why Redis INCR for rate limiting, DB schema reasoning, the full original 48-hour timeline plan) see `reachinbox-blueprint.md`. For the tool/account setup checklist and the originally-planned step-by-step build order (which this file has now superseded with actual real-world progress), see `reachinbox-setup-guide.md`.