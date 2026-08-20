import { Queue } from "bullmq";
import { redisConnection } from "./connection";

export const emailQueue = new Queue("email-queue", {
  connection: redisConnection,
});