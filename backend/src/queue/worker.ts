import { Worker } from "bullmq";
import { redisConnection } from "./connection";
import { sendEmailAsSender } from "../services/mailer";
import {
  markEmailJobSent,
  markEmailJobFailed,
  updateEmailJobBullmqId,
  getEmailJobById,
  getSenderById,
} from "../db/campaignRepo";
import { tryConsumeRateLimit } from "./rateLimiter";
import { emailQueue } from "./emailQueue";
import { reconcileOnBoot } from "./reconcile";

async function startWorker() {
  await reconcileOnBoot();

  const worker = new Worker(
    "email-queue",
    async (job) => {
      const { emailJobId, senderId, to, subject, body } = job.data;
      console.log(`[worker] Processing job ${job.id} at ${new Date().toISOString()}`);

      const currentJob = await getEmailJobById(emailJobId);
      if (currentJob?.status === "sent") {
        console.log(`[worker] Job ${job.id} already marked sent in DB, skipping duplicate send.`);
        return;
      }

      const { allowed, retryAt } = await tryConsumeRateLimit(senderId);

      if (!allowed) {
        const delayMs = retryAt!.getTime() - Date.now();
        const rateLimitRetryCount = (job.data.rateLimitRetryCount ?? 0) + 1;
        const newJobId = `${emailJobId}-rl${rateLimitRetryCount}`;

        console.log(`[worker] Rate limit hit for sender ${senderId}, rescheduling job ${job.id} (retry #${rateLimitRetryCount}) to ${retryAt!.toISOString()}`);

        await emailQueue.add(
          "send-email",
          { ...job.data, rateLimitRetryCount },
          { jobId: newJobId, delay: Math.max(delayMs, 0) }
        );

        await updateEmailJobBullmqId(emailJobId, newJobId);

        return;
      }

      try {
        const sender = await getSenderById(senderId);
        if (!sender) {
          throw new Error(`Sender ${senderId} not found`);
        }

        await sendEmailAsSender(
          { smtpUser: sender.smtp_user, smtpPass: sender.smtp_pass },
          to,
          subject,
          body
        );
        await markEmailJobSent(emailJobId);
        console.log(`[worker] Email sent + DB updated for job ${job.id}`);
      } catch (err) {
        await markEmailJobFailed(emailJobId, String(err));
        throw err;
      }
    },
    {
      connection: redisConnection,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
      limiter: {
        max: 1,
        duration: Number(process.env.MIN_DELAY_MS ?? 2000),
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] Job ${job?.id} failed:`, err);
  });
}

startWorker().catch((err) => {
  console.error("[worker] Failed to start:", err);
  process.exit(1);
});

async function shutdown(signal: string) {
  console.log(`[worker] Received ${signal}, closing gracefully...`);
  await redisConnection.quit();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));