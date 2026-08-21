import { emailQueue } from "./emailQueue";
import {
  getPendingEmailJobsWithCampaignInfo,
  updateEmailJobBullmqId,
} from "../db/campaignRepo";

// States that mean "this job is still going to run, leave it alone"
const SAFE_STATES = new Set(["active", "waiting", "delayed", "waiting-children", "prioritized"]);

export async function reconcileOnBoot(): Promise<void> {
  console.log("[reconcile] Checking for pending email_jobs missing from Redis...");

  const pending = await getPendingEmailJobsWithCampaignInfo();
  let reAdded = 0;

  for (const row of pending) {
    const jobId = row.bullmq_job_id ?? row.id;

    const existing = await emailQueue.getJob(jobId);
    const isSafe = existing && SAFE_STATES.has(await existing.getState());

    if (isSafe) {
      continue;
    }

    const delayMs = Math.max(
      new Date(row.scheduled_for).getTime() - Date.now(),
      0
    );

    await emailQueue.add(
      "send-email",
      {
        emailJobId: row.id,
        senderId: row.sender_id,
        to: row.recipient_email,
        subject: row.subject,
        body: row.body,
      },
      { jobId, delay: delayMs }
    );

    if (row.bullmq_job_id !== jobId) {
      await updateEmailJobBullmqId(row.id, jobId);
    }

    reAdded++;
    console.log(`[reconcile] Re-added missing/lost job ${jobId} (email_jobs.id=${row.id}), delay=${delayMs}ms`);
  }

  console.log(`[reconcile] Done. ${pending.length} pending rows checked, ${reAdded} re-added to queue.`);
}