import { Worker } from "bullmq";
import { redisConnection } from "./connection";

export const worker = new Worker(
  "email-queue",
  async (job) => {
    console.log(`[worker] Processing job ${job.id} at ${new Date().toISOString()}`);
    console.log(`[worker] Job data:`, job.data);
  },
  { connection: redisConnection }
);

worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err);
});