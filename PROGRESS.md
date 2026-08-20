# Progress — ReachInbox Email Scheduler

Backend assignment: delayed email scheduling using BullMQ + Redis, Postgres as source of truth, Ethereal for test sending.

## Done

- [x] Docker infra — Redis + Postgres running (port conflict resolved)
- [x] DB schema — `senders`, `campaigns`, `email_jobs` tables created
- [x] Express + TypeScript server, connected to DB
- [x] BullMQ delayed jobs working against Redis (no cron)
- [x] Ethereal email sending (`mailer.ts` — `sendTestEmail`)
- [x] Full flow proven end-to-end: `scheduleTestEmail.ts` -> BullMQ delay -> `worker.ts` -> `sendTestEmail` -> Ethereal send -> job marked `completed`
  - Verified via terminal output + Ethereal preview URL
  - Committed: "Connect worker to Ethereal mailer, full queue-to-send flow verified"

## In Progress

- [ ] **Step 8 — Wire `campaigns` / `email_jobs` into Postgres**
  - `POST /api/campaigns` should write a row to the DB **and** enqueue the BullMQ job
  - Use the DB row's `id` as the BullMQ `jobId` (this is the idempotency key)
  - Worker should update the DB row's `status` to `sent` after a successful send

## Not Started

- [ ] Step 9 — Restart / reconciliation (recover jobs after a crash, depends on DB being source of truth)
- [ ] Step 10 — Rate limiting (depends on DB being source of truth)

## Key Decisions (the "why" — not visible in code or git log)

- **BullMQ `jobId` = Postgres `email_jobs.id`** -> guarantees idempotency; re-enqueueing the same DB row can't create a duplicate job.
- **Postgres is the source of truth, not Redis/BullMQ.** Redis holds transient queue state; Postgres holds the durable record of what was scheduled/sent. This is why Step 8 (DB wiring) has to land before Step 9 (restart persistence) and Step 10 (rate limiting) — both depend on it.
- **Ethereal used for email sending** instead of a real SMTP/provider — good enough to prove the send path works without needing real credentials or risking real sends during dev.

## Repo / Environment Notes

- Local path: `C:\Users\gouri\OneDrive\Desktop\reachinbox-email-scheduler`
- Backend: `cd backend`, run worker with `npx tsx src/queue/worker.ts`
- Reference docs also in repo: `reachinbox-blueprint.md`, `reachinbox-setup-guide.md`
- `git log --oneline` gives full build order if this file ever falls out of sync

## Next Session — Start Here

Pick up at **Step 8**: DB wiring for campaigns/email_jobs. See "In Progress" above for the exact spec.

---
*Update this file briefly after each meaningful step — a few bullet points, not a diary. Keep "Next Session — Start Here" accurate above all else.*
