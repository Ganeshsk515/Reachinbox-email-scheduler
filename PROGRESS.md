# PROGRESS.md — ReachInbox Email Scheduler (Hiring Assignment)

> Read this whole file before responding to any request in this project. Full original assignment text: `reachinbox-blueprint.md`.

---

## 1. Project summary
Take-home assignment for ReachInbox.ai SDE Intern role, **48-hour limit**. Build an email scheduler (backend) + dashboard (frontend): BullMQ delayed jobs (NO cron), Ethereal fake SMTP, restart-persistent, idempotent, rate-limited per sender/hour.

**Hard constraints:** no cron; BullMQ delayed jobs; survives restart with no duplicates/loss; idempotent.

**Anti-plagiarism:** user wants this "as human as possible" — commit incrementally, don't reference other candidates' solutions, own color/typography instead of copying Figma's.

**Repo:** `Ganeshsk515/Reachinbox-email-scheduler` (private). Collaborators `Mitrajit`/`Yadav036` — **STILL UNCONFIRMED, verify before submission.**

---

## 2. BACKEND: 100% COMPLETE AND VERIFIED. Do not touch unless something is broken.

All hard requirements built AND tested with real output (not assumed):
- Docker (Redis 6379 + Postgres on **5433**, not 5432 — port 5432 taken by unrelated old project), schema applied
- Express 5 + TS (`strict: true`), `/health` route
- BullMQ + Redis delayed jobs — proven
- Ethereal email sending via nodemailer — proven (note: `from` field MUST use object form `{name, address}`, not template string, or Ethereal rejects with 501)
- `POST /api/campaigns` — writes campaign + email_jobs rows, enqueues BullMQ job per recipient using `email_jobs.id` as `jobId` (idempotency key)
- `GET /api/emails?status=scheduled|sent|failed`, `GET /api/campaigns/:id`
- **Restart-persistence PROVEN**: killed worker mid-delay, restarted, job fired correctly, exactly one `sent` row, no duplicates — this is your strongest demo evidence
- **Rate limiting PROVEN**: Redis INCR/EXPIRE hourly counter per sender, tested with limit=2/4 recipients → 2 sent, 2 correctly rescheduled to next hour (jobId becomes `{id}-rl{n}` on reschedule, stays idempotent)
- **DB-reconciliation-on-boot** (bonus, done): `reconcile.ts` checks DB for `scheduled` rows missing from Redis on worker startup, only re-adds genuinely lost ones (checks BullMQ job state first, doesn't duplicate safe jobs)
- **CORS added**: `cors` package installed, `app.use(cors())` in `server.ts` — needed for frontend on :3000 to call backend on :4000

Backend files: `backend/src/{config/env.ts, db/{client.ts,schema.sql,campaignRepo.ts}, queue/{connection.ts,emailQueue.ts,worker.ts,rateLimiter.ts,reconcile.ts}, routes/{campaigns.ts,emails.ts}, services/mailer.ts, server.ts}`

Seed data: one `senders` row, `id: cd07bb53-c67e-4e31-8975-e3ba6d0f078c`, Ethereal test sender. Use this senderId everywhere in frontend too.

**Trade-offs for README:** per-sender SMTP creds stored in DB but not used dynamically (single global Ethereal transporter); no automated tests (manual verification only, reasonable given 48hr limit); email detail view intentionally skipped (not required).

---

## 3. FRONTEND: IN PROGRESS

**Stack:** Next.js 16 (App Router, Turbopack), TypeScript, Tailwind 4 (CSS-based `@theme` config, no `tailwind.config.js`). **No `src/` directory** — `create-next-app` didn't apply the customization prompt twice in a row (used recommended defaults both times), so paths are `frontend/app/...`, `frontend/components/...`, `frontend/lib/...` directly (NOT `frontend/src/app/...`). Adjust any earlier-planned paths accordingly.

**Design decision:** Own color palette/typography, NOT Figma's exact colors — intentional. Palette: indigo/violet primary (`#4f46e5`), near-black sidebar (`#0f0f10`), semantic status colors (amber=scheduled, emerald=sent, rose=failed), Inter font. Defined as CSS custom properties in `frontend/app/globals.css` under `@theme inline`. Utility classes like `bg-primary`, `text-status-sent`, etc. work directly.

### Built and verified so far:
- Next.js scaffold running cleanly on :3000
- `globals.css` — full design tokens defined (see Section 2 palette above)
- `layout.tsx` — uses `next/font/google` Inter, NOT the default Geist
- `components/ui/Button.tsx` — primary/outline variants
- `components/ui/Badge.tsx` — status pill (scheduled/sent/failed), verified rendering correct colors
- `components/ui/Input.tsx`
- `components/ui/EmptyState.tsx`
- `components/ui/Spinner.tsx`
- `components/Sidebar.tsx` — logo, user card (currently hardcoded "Test User"/"test@example.com", NOT real auth yet), Compose button, Scheduled/Sent nav with live counts, active-tab styling. **Verified working** via screenshot.
- `lib/apiClient.ts` — `fetchEmails(status)` function, typed `EmailJob` interface, hits `http://localhost:4000/api/emails?status=X`
- `components/EmailTable.tsx` — renders Email/Subject/Time/Status columns, handles loading (Spinner) and empty (EmptyState) states. **Verified working end-to-end** — real backend data (a test campaign sent via API) rendered correctly in the UI with correct badge color, and sidebar counts updated live from real fetch results.
- `components/ComposeModal.tsx` — Subject, Body (plain textarea, not rich text), CSV upload via `papaparse` with live "N detected" count + removable chips (+N overflow), Delay-between-emails + Hourly-limit numeric inputs, Cancel/Schedule buttons, POSTs to `/api/campaigns` with hardcoded `senderId`. **Rendered and visually verified** — modal opens correctly, form fields all present matching Figma layout intent.
- `app/page.tsx` — wires everything together: tab state, real data fetching per tab, live counts, Compose modal open/close, refresh-on-schedule via `refreshKey` state bump.

### IN PROGRESS RIGHT NOW (pick up here):
Testing the CSV upload → recipient chips → Schedule submission flow end-to-end for the first time. A test file was being created at `C:\Users\gouri\OneDrive\Desktop\test-recipients.csv` (3 test emails + a header row `recipient_email`) to upload into the Compose modal.

**UNVERIFIED — check next:**
1. Does the CSV parser correctly EXCLUDE the header row (`recipient_email`) from the recipient count/chips, or does it mistakenly count it as a fake email? (It contains no `@` so the current filter `.filter((v) => v.includes("@"))` in `ComposeModal.tsx` SHOULD exclude it correctly — but this has not been visually confirmed yet.)
2. Does clicking "Schedule" after uploading actually POST successfully to `/api/campaigns` and show the new campaign in the Scheduled tab afterward?
3. Does the "+N more" chip overflow display correctly if the CSV has more than 6 emails?

---

## 4. Environment gotchas (don't re-debug)
- Windows/PowerShell. `Invoke-RestMethod` + `ConvertTo-Json`, not curl flags.
- User's actual Desktop path is `C:\Users\gouri\OneDrive\Desktop\...` (OneDrive-synced) — plain `C:\Users\gouri\Desktop\...` does NOT exist and will error. Always use the OneDrive path.
- Postgres on port **5433**, not 5432.
- **Always `cd` into `backend/` or `frontend/` before running `npx tsx` or `npm run` commands** — the single most common recurring mistake all session.
- **3 backend terminals needed**: `npm run dev` (server), `npx tsx src/queue/worker.ts` (worker), one free. Frontend needs its own 4th terminal: `npm run dev` in `frontend/` (port 3000).
- Watch for literal PowerShell here-string syntax accidentally pasted into file content (happened once, corrupted `server.ts`) — always `Get-Content` to verify file contents after edits before running.

---

## 5. Exact next steps, in order

1. **Finish testing ComposeModal's CSV upload + submission flow** (see Section 3, "IN PROGRESS RIGHT NOW") — confirm header-row exclusion, successful POST, and that the new campaign appears in Scheduled tab after submission.
2. **NextAuth + Google OAuth** — not started. Need Google Cloud OAuth credentials (user was instructed to set these up early on, unconfirmed if done). Install `next-auth`, create `app/api/auth/[...nextauth]/route.ts`, wrap app in a session provider, replace Sidebar's hardcoded "Test User"/"test@example.com" with real session data (name/email/avatar). Build a real Login page matching Figma frame 1's layout (own colors, not Figma's green).
3. **Route protection** — dashboard should redirect to `/login` if not authenticated.
4. **(Optional/stretch) Email detail view** — clicking a row opens detail (Figma frame 3) — skip if time-constrained, not a hard requirement.
5. **Clean up test data** (`DELETE FROM email_jobs; DELETE FROM campaigns;`) before final demo recording, keep the one `senders` row.
6. **Write README** — architecture overview (source: Section 2 above), setup instructions for backend AND frontend, Ethereal setup steps, feature checklist, assumptions/trade-offs (Section 2's trade-offs list).
7. **Record demo video (max 5 min):** compose flow (real UI) → dashboard Scheduled+Sent tables → **restart-persistence proof** (re-run backend's proven Step 9 sequence on camera — kill worker mid-delay, restart, show it still sends correctly with no duplicates) → bonus: rate-limit-under-load demo (re-run backend's proven test with a temporarily-lowered limit).
8. **Confirm GitHub collaborators** `Mitrajit`/`Yadav036` actually added — still unconfirmed.
9. **Fill out ClickUp submission form**: https://forms.clickup.com/9005062261/f/8cbwp3n-8876/6NNNJ92DV93PQTAYST

For full architecture rationale see `reachinbox-blueprint.md`. Original setup checklist in `reachinbox-setup-guide.md` (superseded by this file's real progress).