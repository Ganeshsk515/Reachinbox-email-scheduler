import { Worker } from "bullmq";
import { redisConnection } from "./connection";
import { sendTestEmail } from "../services/mailer";
import { markEmailJobSent, markEmailJobFailed } from "../db/campaignRepo";

export const worker = new Worker(
  "email-queue",
  async (job) => {
    const { emailJobId, to, subject, body } = job.data;
    console.log(`[worker] Processing job ${job.id} at ${new Date().toISOString()}`);

    try {
      await sendTestEmail(to, subject, body);
      await markEmailJobSent(emailJobId);
      console.log(`[worker] Email sent + DB updated for job ${job.id}`);
    } catch (err) {
      await markEmailJobFailed(emailJobId, String(err));
      throw err; // let BullMQ know it failed too
    }
  },
  { connection: redisConnection }
);

worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err);
});