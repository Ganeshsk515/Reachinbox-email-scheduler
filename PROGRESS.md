# Progress Log — ReachInbox Email Scheduler

> Update this after finishing each step. Paste this whole file into a new Claude/AI session if you need to resume with a different session — it gives full context without re-explaining from scratch.

## Stack decisions (locked in, don't change)
- Backend: Express 5 + TypeScript (strict mode), tsx for dev
- Queue: BullMQ + Redis (via ioredis)
- DB: Postgres (raw SQL via `pg`, no ORM)
- Email: Ethereal (nodemailer)
- Frontend: not started yet — Next.js + NextAuth (Google OAuth) + Tailwind planned

## Environment notes (machine-specific gotchas — don't re-debug these)
- Postgres runs on **port 5433**, not 5432 (5432 was taken by an unrelated old project's container `rpg-portfolio-db-1`)
- `docker-compose.yml` maps `5433:5432`
- `backend/.env` DATABASE_URL uses port 5433 accordingly
- Redis runs on default port 6379, no conflicts
- Ethereal account: hildegard.kihn59@ethereal.email (test/disposable credentials, already in `backend/.env`)
- Always run `npx tsx ...` commands from inside `backend/`, not repo root — this has been the #1 recurring mistake

## Steps completed so far
- [x] Step 1: Repo created, private, collaborators (Mitrajit, Yadav036) added
- [x] Step 2: Docker Compose (Redis + Postgres) running
- [x] Step 3: DB schema applied (`senders`, `campaigns`, `email_jobs` tables)
- [x] Step 4: Express + TypeScript server with `/health` route, confirmed DB-connected
- [x] Step 5: BullMQ + Redis wired, delayed job tested and confirmed (10s delay verified)
- [x] Step 6: Ethereal email sending via nodemailer, standalone test confirmed
- [x] Step 7: Worker wired to actually send email via Ethereal when a job fires — full queue-to-send flow confirmed end-to-end

## Current folder structure (backend)
```
backend/src/
├── config/
│   └── env.ts
├── db/
│   ├── client.ts
│   └── schema.sql
├── queue/
│   ├── connection.ts
│   ├── emailQueue.ts
│   ├── worker.ts
│   └── scheduleTestEmail.ts   (manual test script — will remove once real routes exist)
├── services/
│   ├── mailer.ts
│   └── testMailer.ts          (manual test script — will remove once real routes exist)
└── server.ts
```

## Next step (not started)
**Step 8: Wire campaigns/email_jobs into Postgres.**
- `POST /api/campaigns` should write to DB (`campaigns` + `email_jobs` rows) AND enqueue BullMQ jobs
- Use each `email_jobs.id` (UUID) as the BullMQ `jobId` — this is the idempotency key (BullMQ dedupes on `jobId` automatically)
- Worker should update the DB row's `status` to `sent` (or `failed`) after processing, not just log to console
- This unlocks Step 9 (restart/reconciliation) and Step 10 (rate limiting), both of which depend on DB being the source of truth

## Known trade-offs / things to mention in final README
- (add as they come up)

## Full architecture reference
See `reachinbox-blueprint.md` (in repo root or wherever you saved it) for the full system design, DB schema rationale, rate-limiting design, and 48-hour timeline.
See `reachinbox-setup-guide.md` for tools/accounts checklist and the full step-by-step build order.