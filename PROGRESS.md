# PROGRESS.md — ReachInbox Email Scheduler (Hiring Assignment)

> Read this whole file before responding to any request in this project. Full original assignment text: `reachinbox-blueprint.md`.

---

## 1. Project summary
Take-home assignment for ReachInbox.ai SDE Intern role, **48-hour limit**. Email scheduler (backend) + dashboard (frontend): BullMQ delayed jobs (NO cron), Ethereal fake SMTP, restart-persistent, idempotent, rate-limited per sender/hour.

**Repo:** `Ganeshsk515/Reachinbox-email-scheduler` (private). Collaborators `Mitrajit`/`Yadav036` — **STILL UNCONFIRMED as of this update, verify before submission — flagged repeatedly all session, not yet explicitly confirmed done.**

**Anti-plagiarism note:** mid-session, the user showed an AI a README from an unknown source describing a similar-but-different project (used Prisma, different file structure, different rate-limit status naming, unverified "manually tested" claims). It was explicitly flagged as NOT matching this actual project and NOT used verbatim. One idea from it (checking DB status as a second idempotency layer, independent of BullMQ's jobId dedup) was adopted and implemented properly, in this project's own code/style — see Section 2. Do not reintroduce anything else from that other README (Prisma, its file structure, its exact wording) — this project intentionally does not use an ORM.

---

## 2. BACKEND: 100% COMPLETE, VERIFIED, AND NOW INCLUDES A SECOND IDEMPOTENCY LAYER

All hard requirements built and tested with real output:
- Docker (Redis 6379 + Postgres on **5433**, not 5432), schema applied
- Express 5 + TS (`strict: true`)
- BullMQ + Redis delayed jobs, Ethereal sending (mailer's `from` field MUST use object form `{name, address}`, not template string)
- `POST /api/campaigns`, `GET /api/emails?status=`, `GET /api/campaigns/:id`
- **Restart-persistence PROVEN** (kill worker mid-delay, restart, job fires correctly, no duplicates)
- **Rate limiting PROVEN** (Redis INCR/EXPIRE per sender/hour, tested overflow reschedules correctly to next hour)
- **DB-reconciliation-on-boot** (`reconcile.ts`) — only re-adds genuinely lost jobs, checks BullMQ state first
- **NEW: Second idempotency layer added to `worker.ts`** — before sending, worker calls `getEmailJobById(emailJobId)` and skips the send entirely if DB status is already `'sent'`. This means idempotency doesn't rely on BullMQ's jobId dedup alone; the DB is checked independently as the final source of truth. Verified: normal sends still work correctly after adding this guard (sanity-tested with a fresh campaign, processed normally, no regression).
- **CORS added** (`cors` package, `app.use(cors())` in `server.ts`)

**NEW: 1000-email load test performed and verified:**
- Fired a real campaign via the API with 1000 recipients (`load-test-1@example.com` ... `load-test-1000@example.com`), `delayBetweenMs: 500`
- API accepted and created all 1000 rows without error
- Worker processed them in correct order, confirmed via UI screenshot showing descending timestamps ~1 second apart
- After some processing time: DB showed `52 sent, 948 scheduled` — zero failures, zero corruption at scale
- **This data has since been cleaned up** (see Section 4) — don't assume load-test rows still exist in the DB
- This result is good evidence for the "behavior under load" section of the README/demo, though the controlled small-scale rate-limit-overflow test (2/4 recipients, limit=2) remains the cleanest specific proof of the reschedule-to-next-hour behavior, already documented in the README

Backend files: `backend/src/{config/env.ts, db/{client.ts,schema.sql,campaignRepo.ts}, queue/{connection.ts,emailQueue.ts,worker.ts,rateLimiter.ts,reconcile.ts}, routes/{campaigns.ts,emails.ts}, services/mailer.ts, server.ts}`

Seed data: one `senders` row, `id: cd07bb53-c67e-4e31-8975-e3ba6d0f078c`, Ethereal test sender — used everywhere (backend tests, frontend compose form hardcoded senderId).

---

## 3. FRONTEND: COMPLETE (all planned features built and verified)

**Stack:** Next.js 16 (App Router, Turbopack), TypeScript, Tailwind 4 (CSS `@theme` tokens in `globals.css`, no `tailwind.config.js`). **No `src/` directory** — paths are `frontend/app/...`, `frontend/components/...`, `frontend/lib/...` directly.

**Design:** Own palette (indigo primary `#4f46e5`, near-black sidebar `#0f0f10`, semantic status badges), Inter font — intentionally NOT matching Figma's exact colors, following Figma's layout/UX only.

### All built and verified:
- `components/ui/{Button,Badge,Input,EmptyState,Spinner}.tsx`
- `components/Sidebar.tsx` — real user data, active-tab styling, live counts, **Logout button** (fixed a visibility bug: had to use `text-white/60` instead of `text-sidebar-muted` which blended into the dark background)
- `lib/apiClient.ts`, `components/EmailTable.tsx` — verified end-to-end with real backend data
- `components/ComposeModal.tsx` — Subject/Body/CSV-upload-with-chips/Delay/Hourly-limit/Schedule, verified full flow works (CSV correctly excludes header row from recipient count)
- `components/Dashboard.tsx` — main logic, accepts `userName`/`userEmail` as props (from real session, not hardcoded)
- **NextAuth v5 + Google OAuth — fully working, verified with a real Gmail login** (tested with account "Son Goku" / a real gmail.com address). Key bug fixed: `auth.ts`'s shorthand `providers: [Google]` expects env vars named `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` by NextAuth's auto-detection convention — this project's `.env.local` uses `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` instead, so `auth.ts` explicitly passes `clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET` into the Google provider rather than relying on auto-detection.
- `app/layout.tsx` wraps app in `SessionProvider` (needed for client-side `signOut` in Sidebar)
- `app/page.tsx` — server component, checks `auth()`, redirects to `/login` if no session
- `app/login/page.tsx` — real login screen, own colors

**Frontend is functionally done.** No major pieces remain except optional stretch (email detail view — intentionally skipped, documented as such in README).

---

## 4. README: WRITTEN AND COMMITTED

A complete `README.md` was written and pushed, covering: tech stack, project structure, full setup instructions (backend + frontend + Ethereal + Google OAuth), architecture explanation (no-cron, two-layer idempotency, restart survival, concurrency/delay/rate-limiting with exact mechanism described, behavior under load), API reference, features-implemented checklist, and an honest assumptions/trade-offs section. Every claim in it is grounded in something actually tested this session — no invented/unverified claims.

**Post-load-test cleanup performed:**
```sql
DELETE FROM email_jobs WHERE recipient_email LIKE 'load-test-%';
DELETE FROM campaigns WHERE subject = '1000 email load test';
```
Plus a `redis-cli FLUSHALL` was recommended/likely run to clear ~900 still-queued BullMQ delayed jobs left over from the load test (since deleting DB rows alone doesn't stop already-enqueued BullMQ jobs from firing on their own timers). **If picking this up fresh: verify Redis and Postgres are both actually clean before recording the final demo** — run:
```sql
SELECT status, COUNT(*) FROM email_jobs GROUP BY status;
```
and
```
docker exec -it reachinbox-redis redis-cli KEYS "*"
```
to confirm no leftover load-test jobs remain in either place. Both backend server and worker should be restarted fresh after any FLUSHALL, since a flushed Redis means BullMQ's queue metadata is gone too.

---

## 5. Environment gotchas (don't re-debug)
- Windows/PowerShell. `Invoke-RestMethod` + `ConvertTo-Json`, not curl flags.
- User's Desktop path is `C:\Users\gouri\OneDrive\Desktop\...` (OneDrive-synced) — plain `C:\Users\gouri\Desktop\...` does NOT exist.
- Postgres on port **5433**, not 5432.
- PowerShell treats `[...]` in file paths (e.g. NextAuth's `[...nextauth]` folder) as wildcard glob syntax — use `Get-Content -LiteralPath "..."` to check those files directly, plain `Get-Content` will falsely report "not found" even when the file exists.
- **Always `cd` into `backend/` or `frontend/` before running `npx tsx`/`npm run` commands.**
- **4 terminals needed for full-stack local dev**: backend `npm run dev` (:4000), backend worker (`npx tsx src/queue/worker.ts`), frontend `npm run dev` (:3000), one free for testing/git/psql/redis-cli.
- Env var changes require a full dev-server restart (not just save) to take effect — bit both the worker (rate-limit testing) and NextAuth (Google credentials) at different points this session.

---

## 6. Exact remaining steps to submission, in order

1. **Verify Redis/Postgres are fully clean** post-load-test (see Section 4) — restart backend server + worker fresh after confirming.
2. **Confirm GitHub collaborators** `Mitrajit`/`Yadav036` are actually added — flagged repeatedly, still unconfirmed. Do this now, it's a 30-second check.
3. **Record demo video (max 5 min):**
   - Compose flow from the real UI (small, clean recipient list — not the 1000-email load test)
   - Dashboard showing Scheduled + Sent tables with real data
   - **Restart-persistence proof** — re-run live: schedule → confirm DB `scheduled` → kill worker → wait → restart → show it fires correctly, single `sent` row, no duplicates
   - Bonus: rate-limit demo — temporarily lower `MAX_EMAILS_PER_HOUR_PER_SENDER`, show the "rescheduling" log message live
   - Optional bonus: briefly mention/show the 1000-email load test result (52 sent / 948 scheduled, zero errors) as evidence of scale handling, without necessarily re-running the full thing on camera
4. **Fill out the ClickUp submission form**: https://forms.clickup.com/9005062261/f/8cbwp3n-8876/6NNNJ92DV93PQTAYST — repo link, video link, any notes on assumptions.

Everything else (backend, frontend, README) is DONE. This is purely cleanup + video + submission logistics from here.

For full architecture rationale see `reachinbox-blueprint.md`. Original setup checklist in `reachinbox-setup-guide.md` (fully superseded by this file and the actual README now).