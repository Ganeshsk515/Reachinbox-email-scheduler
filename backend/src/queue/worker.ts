import { Worker } from "bullmq";
import { redisConnection } from "./connection";
import { sendTestEmail } from "../services/mailer";

export const worker = new Worker(
  "email-queue",
  async (job) => {
    console.log(`[worker] Processing job ${job.id} at ${new Date().toISOString()}`);

    const { to, subject, body } = job.data;
    await sendTestEmail(to, subject, body);

    console.log(`[worker] Email sent for job ${job.id}`);
  },
  { connection: redisConnection }
);

worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err);
});