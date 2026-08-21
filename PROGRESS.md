# PROGRESS.md — ReachInbox Email Scheduler (Hiring Assignment)

> **Purpose of this file:** Complete state snapshot. If you are an AI assistant reading this for the first time, you should understand the entire project — what it is, why every decision was made, what's built, what's tested, what's left — without the user re-explaining anything. Read this whole file before responding to any request in this project.

---

## 1. What this project actually is

Take-home hiring assignment for a Software Development Intern role at **ReachInbox.ai** (product of Outbox Labs). User has been shortlisted, **48-hour time limit**. Full original assignment text is in `reachinbox-blueprint.md`.

**One-line summary:** Build a production-grade email scheduler service (backend) + dashboard (frontend) that schedules emails using BullMQ delayed jobs (NOT cron), sends via Ethereal fake SMTP, survives server restarts without duplicating or losing jobs, and enforces configurable rate limits per sender per hour.

**Grading priorities, in order:**
1. Restart-persistence — proven, see Section 6
2. Distributed-safe rate limiting — proven, see Section 6
3. Idempotency — proven, see Section 6
4. Code structure/cleanliness
5. README quality
6. Frontend polish and Figma *layout/UX* fidelity (NOT exact colors — see Section 8, user has decided to apply their own color theory/typography rather than copy Figma's palette)

**Hard constraints (non-negotiable):**
- No cron jobs of any kind
- Scheduling must use BullMQ delayed jobs
- Must survive restart: future jobs still fire, no duplicates
- No duplicate sends — idempotency mandatory

**Anti-plagiarism context:** User wants this "as human as possible." AI assistance (this conversation) is fine — the actual risk is (a) looking similar to another candidate's submission for this recurring assignment, (b) not being able to personally explain the code. Practical implications: commit incrementally, let user write core logic where reasonable, don't reference other candidates' solutions.

---

## 2. Company/assignment context

ReachInbox.ai: AI-driven cold email outreach platform. This assignment is a "tiny slice" of their real system.

**Submission requirements:**
- Private GitHub repo — done: `https://github.com/Ganeshsk515/Reachinbox-email-scheduler`
- Collaborators `Mitrajit` and `Yadav036` — **STILL UNCONFIRMED, verify before submission**
- README with setup + architecture + feature checklist — **NOT YET WRITTEN**
- Demo video (max 5 min) — **NOT YET RECORDED**
- ClickUp submission form: https://forms.clickup.com/9005062261/f/8cbwp3n-8876/6NNNJ92DV93PQTAYST — **NOT YET SUBMITTED**
- Note assumptions/shortcuts/trade-offs — draft list in Section 9 below

**Figma (view-only access, layout reference only):**
`https://www.figma.com/design/kOTwGlESjijCYnMgtHfvfU/Outbox-Labs-Assignment?node-id=59-4050&p=f`
Could not be fetched by AI tools automatically (Figma blocks robots) — user screenshotted all frames manually and shared them. **Decision made: replicate the Figma's LAYOUT/UX structure and component behavior, but apply an original color palette and typography rather than copying Figma's exact colors/fonts.** This is intentional and fine — assignment says "closely follows" the design, not pixel-identical colors.

### Figma frames reviewed (full breakdown):
1. **Login Screen** — centered white card, dark page background. "Login" heading. "Login with Google" button (light green bg in Figma, full width). Divider "or sign up through email". Email ID + Password fields shown but NOT required to build real email/password auth — only Google OAuth is a hard requirement; the email/password fields can be omitted or left decorative.
2. **Homepage/Dashboard** — Left sidebar (~280-300px, dark): logo wordmark, user profile card (avatar/name/email + dropdown chevron), green "Compose" button, nav items "Scheduled" (with count badge) and "Sent" (with count badge). Main panel: search bar w/ filter+refresh icons, list of email rows (To: name, timestamp pill, subject + preview snippet, star icon).
3. **Email detail view** (click an email) — back arrow, subject header, sender avatar/name/email/timestamp, body content, attachment thumbnails. **Treated as optional/stretch, not a hard requirement** — assignment only asks for table/list view with Email/Subject/Time/Status columns.
4. **Compose New Email** — back arrow, header, paperclip + clock (send-later) icons, Send/Send Later button. Fields: From (dropdown, prefilled sender), To (with "Upload List" link = CSV upload), Subject, **Delay between 2 emails** + **Hourly Limit** (numeric inputs — maps directly to backend's `delayBetweenMs`/`maxEmailsPerHour`), rich text body editor with formatting toolbar.
5. **Recipient chips** — once recipients added (via CSV or manual), shown as removable chips with "+N" overflow badge for large lists.
6. **"Send Later" popover** — clicking clock icon opens: "Pick date & time" input + quick-pick shortcuts (Tomorrow, Tomorrow 10AM, Tomorrow 11AM, Tomorrow 3PM), Cancel/Done buttons.

### Design direction (OWN palette/typography, not Figma's — user's explicit decision):
- Suggested primary accent: indigo/violet (`#6366f1`–`#4f46e5`) or warm amber (`#f59e0b`) instead of Figma's green — more distinctive, avoids generic-SaaS look
- Neutrals: near-black sidebar (`#0f0f10`), warm-gray text tones, not pure black/white
- Status badges: scheduled = amber, sent = emerald, failed = rose (keep semantically intuitive regardless of primary accent choice)
- Typography: Inter or Geist, heavier weight (600) for headings vs regular body
- **This decision is final — do not suggest reverting to Figma's literal green/colors.**

---

## 3. Tech stack (locked in)

| Layer | Choice | Notes |
|---|---|---|
| Backend language | TypeScript, `strict: true` | Hard requirement |
| Backend framework | Express 5 (`^5.2.1`) | v5 async handlers auto-catch rejected promises |
| Dev runtime | `tsx watch` | Not `ts-node-dev` |
| Queue | BullMQ (`^6.1.2`) + Redis (`ioredis@6.0.0`) | No cron |
| Database | PostgreSQL 16 (alpine, Docker) | Raw SQL via `pg`, no ORM |
| Email | Ethereal (fake SMTP) via `nodemailer` | Disposable test account |
| Frontend | Next.js + NextAuth (Google OAuth) + Tailwind — **NOT STARTED YET** | Own color palette, see Section 2 |
| Infra | Docker Compose (Redis + Postgres) | |

**Repo:** `Ganeshsk515/Reachinbox-email-scheduler`, private.

---

## 4. Environment-specific facts (don't re-debug these)

- Windows + PowerShell. Use `Invoke-RestMethod` with `ConvertTo-Json`, not `curl`/`Invoke-WebRequest` flags.
- **Postgres on host port 5433, NOT 5432** (5432 taken by unrelated old project `rpg-portfolio-db-1`). `docker-compose.yml` maps `5433:5432`. `.env` DATABASE_URL uses 5433.
- Redis on default 6379.
- **#1 recurring mistake:** running `npx tsx src/...` from repo root instead of `backend/`. Always `cd` into `backend/` first.
- Repo path: `C:\Users\gouri\OneDrive\Desktop\reachinbox-email-scheduler`
- Watch for literal PowerShell here-string syntax (`@'...'@`) accidentally pasted into file content — happened once, corrupted `server.ts`. Always `Get-Content` to verify after edits.
- **Running full stack needs 3 terminals**: (1) `npm run dev` in `backend/`, (2) `npx tsx src/queue/worker.ts` in `backend/`, (3) free terminal for testing/git/psql.

**Ethereal test account (in `backend/.env`):**
```
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=hildegard.kihn59@ethereal.email
ETHEREAL_PASS=5Jy56NqNKSEysRXwVS
```
`mailer.ts`'s `from` field MUST use object form `{ name, address }`, not a template-string `"Name" <email>` — the latter caused `501 Bad sender address syntax` from Ethereal.

**Seed data:** One `senders` row:
```
id: cd07bb53-c67e-4e31-8975-e3ba6d0f078c
name: Ethereal Test Sender
smtp_user: hildegard.kihn59@ethereal.email
```
Use this `senderId` for all test campaigns.

**Current `.env` values (production-appropriate, already reset after testing):**
```
WORKER_CONCURRENCY=5
MIN_DELAY_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200
```

---

## 5. Database schema (as applied)

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
  bullmq_job_id TEXT,
  attempts INT DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (campaign_id, recipient_email)
);

CREATE INDEX idx_email_jobs_status ON email_jobs(status);
CREATE INDEX idx_email_jobs_scheduled_for ON email_jobs(scheduled_for);
```
File: `backend/src/db/schema.sql`

**Idempotency:** `email_jobs.id` used directly as BullMQ `jobId`. BullMQ dedupes on `jobId` automatically. For rate-limit reschedules, jobId becomes `{emailJobId}-rl{retryCount}` (see `worker.ts` below) to allow the re-add; `bullmq_job_id` column on the DB row is kept in sync via `updateEmailJobBullmqId` so reconciliation checks the right id.

---

## 6. BACKEND: 100% COMPLETE. Every hard requirement built AND verified with real tested output.

### Files that exist (backend/src/):
```
config/env.ts              — env var loading + validation
db/
  client.ts                 — pg Pool
  schema.sql
  campaignRepo.ts            — createCampaign, createEmailJob, markEmailJobSent,
                                markEmailJobFailed, getEmailJobById, updateEmailJobBullmqId,
                                getEmailJobsByStatus, getCampaignById,
                                getPendingEmailJobsWithCampaignInfo
queue/
  connection.ts              — ioredis connection
  emailQueue.ts               — BullMQ Queue instance
  worker.ts                   — BullMQ Worker: rate-limit check → send via Ethereal →
                                 update DB; calls reconcileOnBoot() on startup
  rateLimiter.ts              — tryConsumeRateLimit(senderId), getStartOfNextHour()
  reconcile.ts                 — reconcileOnBoot(): re-enqueues DB rows with status='scheduled'
                                  that are missing/lost from Redis on server startup
routes/
  campaigns.ts                 — POST /api/campaigns (create + schedule), GET /api/campaigns/:id
  emails.ts                    — GET /api/emails?status=scheduled|sent|failed
services/
  mailer.ts                    — nodemailer transporter + sendTestEmail()
server.ts                      — Express app, wires all routers, /health route
```

### What's proven, with real test evidence (not just "should work"):

- **Steps 1-7** (repo, Docker infra, schema, Express+TS server, BullMQ+Redis delayed jobs, Ethereal sending, worker→Ethereal integration) — all individually verified early in the build, each in isolation before combining.

- **Step 8 — DB-backed campaigns (CORE FEATURE):** `POST /api/campaigns` writes campaign + one email_job row per recipient, enqueues one BullMQ job per recipient with `email_jobs.id` as `jobId`. Verified end-to-end: API call → DB rows `status: scheduled` → jobs fire → Ethereal sends → DB updated to `status: sent` with real `sent_at` timestamps. Confirmed via direct SQL.

- **Step 9 — RESTART/PERSISTENCE PROOF (your strongest evidence, record this for the demo video):**
  1. Scheduled real campaign via API, `startTime` ~2 min out
  2. Confirmed DB row `status: scheduled` beforehand
  3. Fully killed worker process (`Ctrl+C`, confirmed terminated)
  4. Waited ~15s with worker completely down
  5. Restarted worker fresh
  6. Job fired automatically at correct time, no manual re-trigger
  7. Confirmed via SQL: exactly ONE row, `status: sent` — no duplicates

- **Step 10 — Rate limiting (Redis INCR/EXPIRE, distributed-safe):** Temporarily set `MAX_EMAILS_PER_HOUR_PER_SENDER=2`, fired 4-recipient campaign. Worker log showed: job 1 sent, job 2 sent, job 3 → `"Rate limit hit for sender ..., rescheduling job ... (retry #1) to 2026-08-21T04:00:00.000Z"`, job 4 → same. DB confirmed: 2 rows `sent`, 2 rows still `scheduled` with `scheduled_for` pushed to next hour. **Reset back to 200 after test, confirmed reset.**

- **Step 11 — DB-reconciliation-on-boot (bonus, built ahead of schedule) + remaining GET routes:**
  - `reconcile.ts`'s `reconcileOnBoot()` runs on every worker startup, checks DB for `status='scheduled'` rows, checks each against Redis via `SAFE_STATES` set (`active`, `waiting`, `delayed`, `waiting-children`, `prioritized`) — only re-adds genuinely missing/lost jobs, doesn't duplicate ones already safely queued. **This is more sophisticated than a naive "re-add everything" approach and is worth highlighting in the README.**
  - Verified working: a stuck test job was correctly detected, found already-safe in Redis (0 re-added, correctly not duplicating), then processed normally when its original delay elapsed.
  - `GET /api/emails?status=sent` and `?status=scheduled` — verified returning correct joined data (recipient_email, subject, status, scheduled_for, sent_at).
  - `GET /api/campaigns/:id` — built, not yet explicitly curl-tested but trivial/low-risk (simple SELECT by id).
  - **One bug hit and fixed during this step:** an AI-provided "complete" version of `campaignRepo.ts` incorrectly guessed a function name (`getPendingEmailJobs` instead of the actual `getPendingEmailJobsWithCampaignInfo` that `reconcile.ts` imports), which broke the worker on restart. Fixed by adding the correctly-named, correctly-joined function. **Lesson for future AI sessions: always check existing file contents before providing "full file replacements," don't guess function names/signatures.**

### Backend verdict: every single hard requirement (no cron, BullMQ delayed jobs, restart-persistence, idempotency, distributed rate limiting) is DONE and has real verified test output behind it, not just written code. Nothing backend-related is blocking submission except the README and demo video (Section 9).

---

## 7. Known trade-offs / things to mention in README's "assumptions" section

- Per-sender SMTP credentials are stored in the `senders` table (`smtp_user`/`smtp_pass` columns) but not yet used dynamically — `mailer.ts` currently sends via one hardcoded global Ethereal transporter built from `.env` values, not built per-sender from the DB row at send time. Reasonable simplification for a single-test-sender assignment scope; would need a small refactor (transporter factory keyed by sender) to be fully multi-sender in production.
- No automated tests (unit/integration) — everything manually verified via real API calls + direct SQL checks, appropriate given the 48-hour constraint.
- `GET /api/campaigns/:id` built but not yet explicitly curl-tested (low risk, simple query).
- Email detail view (from Figma frame 3) intentionally not built — not a hard requirement, table/list view satisfies the assignment spec.
- Own color palette/typography used instead of matching Figma's exact colors — explicit, intentional choice (see Section 2).

---

## 8. FRONTEND: NOT STARTED. Full plan below — this is 100% of what's left except README/demo/submission logistics.

### 8a. Design system decisions (already made, don't re-litigate — see Section 2 for exact values)
Own palette: indigo/violet or amber primary accent, near-black sidebar, Inter/Geist typography, semantic status badges (amber=scheduled, emerald=sent, rose=failed). Layout/UX structure follows Figma frames faithfully; colors/fonts do not.

### 8b. Component plan (from Figma frame breakdown, Section 2)
```
frontend/src/
├── app/ (or pages/)
│   ├── login/                       — matches Figma frame 1
│   ├── dashboard/                   — matches Figma frame 2 (layout shell + list)
│   └── api/auth/[...nextauth]/      — NextAuth Google OAuth handler
├── components/
│   ├── ui/
│   │   ├── Button.tsx               (primary/outline variants)
│   │   ├── Input.tsx
│   │   ├── Badge.tsx                (status pills)
│   │   ├── Avatar.tsx
│   │   ├── EmptyState.tsx
│   │   └── Spinner.tsx
│   ├── Sidebar.tsx                  (logo, user card, Compose button, nav w/ counts)
│   ├── EmailListRow.tsx             (to/subject/timestamp/preview row)
│   ├── EmailTable.tsx               (wraps rows; handles loading + empty states)
│   ├── ComposeModal.tsx             (matches Figma frames 4-5)
│   │   ├── RecipientChips.tsx        (chip input w/ +N overflow, CSV parse result)
│   │   └── SendLaterPopover.tsx      (matches Figma frame 6)
│   └── EmailDetailView.tsx          (OPTIONAL/stretch — skip if time-constrained)
├── lib/
│   ├── apiClient.ts                  (typed fetch wrapper for backend API)
│   └── types.ts                      (shared TS interfaces matching backend response shapes)
└── hooks/
    └── useEmails.ts                  (data-fetching hook for scheduled/sent lists)
```

### 8c. Build order for frontend (do in this sequence)
1. **Scaffold Next.js app** (`npx create-next-app@latest` inside `frontend/`, TypeScript + Tailwind + App Router)
2. **NextAuth + Google OAuth setup** — needs Google Cloud OAuth credentials (client ID/secret) created separately by the user; confirm login → redirect to dashboard → user info (name/email/avatar) shown in header works BEFORE building any data tables
3. **Build `ui/` primitives first** (Button, Input, Badge, Avatar, EmptyState, Spinner) using the chosen color palette/typography — these get reused everywhere, build once, correctly
4. **Sidebar component** — logo, user profile card (pulls from NextAuth session), Compose button, nav items with live counts (fetch counts from `GET /api/emails?status=X` and use `.length`, or add a lightweight count-only backend endpoint if performance matters — not built yet, simplest is just counting the returned array client-side for now given data volumes are small)
5. **EmailTable + EmailListRow** — wire to `GET /api/emails?status=scheduled` and `?status=sent`, with loading spinner + EmptyState for zero-results case (assignment explicitly requires both loading and empty states)
6. **ComposeModal** — Subject/Body fields, CSV upload (parse client-side, e.g. with `papaparse`, show "N email addresses detected" per assignment spec), recipient chips display, Delay-between-emails + Hourly-limit numeric inputs, Start-time picker (can reuse/simplify the "Send Later" popover concept from Figma frame 6), Schedule button → POSTs to `/api/campaigns`
7. **Wire Compose submission → real backend** — confirm a real campaign created from the UI shows up correctly in the Scheduled table moments later
8. **(Optional, only if time allows) EmailDetailView** — clicking a row opens detail view matching Figma frame 3

### 8d. Explicit reminders for whoever picks up frontend work
- Backend is fully running and correct — do NOT modify backend files while building frontend unless something is genuinely broken. If an API response shape doesn't match what the frontend expects, check `GET /api/emails` and `GET /api/campaigns/:id` responses first (Section 6) before assuming a bug.
- CORS: backend currently has no CORS middleware configured — will need `cors` package added to `server.ts` (`app.use(cors())` or scoped to the frontend's origin) once frontend starts making real cross-origin requests during local dev (Next.js typically runs on port 3000, backend on 4000).
- Use `senderId: cd07bb53-c67e-4e31-8975-e3ba6d0f078c` as the only available sender for the compose form for now (no sender-management UI exists or is required).

---

## 9. Exact remaining steps to submission, in order

1. **Build frontend** — follow Section 8c's build order exactly, step by step, verifying each piece before moving to the next (same discipline used for backend).
2. **Add CORS middleware to backend** (`npm install cors` + `@types/cors`, wire into `server.ts`) — needed once frontend makes real requests.
3. **Clean up all test data** from `email_jobs`/`campaigns` tables before final demo recording.
4. **Write the README** — architecture overview (use Section 6 as the source), setup instructions for backend + frontend, Ethereal setup, feature checklist mapped to requirements, assumptions/trade-offs (use Section 7 as the draft list).
5. **Record demo video (max 5 min):**
   - Compose flow (from real UI)
   - Dashboard showing Scheduled + Sent tables
   - **Restart proof** — re-run the exact Step 9 sequence from Section 6 on camera (this is your strongest, already-proven segment)
   - Bonus: rate-limit-under-load demonstration (re-run Step 10's test from Section 6 on camera)
6. **Confirm GitHub collaborators** (`Mitrajit`, `Yadav036`) are actually added — still unconfirmed as of this file's last update.
7. **Fill out the ClickUp submission form** with repo link, video link, any notes.

For full architecture rationale (why BullMQ over cron, why Redis INCR for rate limiting, DB schema reasoning, original 48-hour timeline) see `reachinbox-blueprint.md`. For the original tool/account setup checklist see `reachinbox-setup-guide.md` (largely superseded by this file's real-world progress now).