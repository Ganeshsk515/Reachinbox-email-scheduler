import { emailQueue } from "./emailQueue";

async function main() {
  console.log(`[test] Scheduling email at ${new Date().toISOString()}`);

  await emailQueue.add(
    "send-email",
    {
      to: "someone@example.com",
      subject: "Scheduled via BullMQ",
      body: "This email was sent by the worker after a delay, pulled from the queue.",
    },
    { delay: 10000 }
  );

  console.log("[test] Job queued, will process in 10 seconds");
}

main();