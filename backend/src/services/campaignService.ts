cd C:\Users\gouri\OneDrive\Desktop\reachinbox-email-scheduler\backend\src

@'
import { pool } from "../db/client";
import { emailQueue } from "../queue/emailQueue";

interface CreateCampaignInput {
  subject: string;
  body: string;
  senderId?: string | null;
  delayBetweenMs: number;
  maxEmailsPerHour: number;
  startTime: string; // ISO string
  recipients: string[];
}

export async function createCampaign(input: CreateCampaignInput) {
  const { subject, body, senderId, delayBetweenMs, maxEmailsPerHour, startTime, recipients } = input;

  if (!recipients || recipients.length === 0) {
    throw new Error("recipients array must not be empty");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const campaignResult = await client.query(
      `INSERT INTO campaigns (subject, body, sender_id, delay_between_ms, max_emails_per_hour, start_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [subject, body, senderId ?? null, delayBetweenMs, maxEmailsPerHour, startTime]
    );
    const campaignId = campaignResult.rows[0].id;

    const start = new Date(startTime).getTime();
    const emailJobs: { id: string; recipientEmail: string; scheduledFor: Date }[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipientEmail = recipients[i];
      const scheduledFor = new Date(start + i * delayBetweenMs);

      const jobResult = await client.query(
        `INSERT INTO email_jobs (campaign_id, recipient_email, scheduled_for)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [campaignId, recipientEmail, scheduledFor]
      );

      emailJobs.push({ id: jobResult.rows[0].id, recipientEmail, scheduledFor });
    }

    await client.query("COMMIT");

    // Enqueue only after the DB commit succeeds — DB row is the source of truth
    for (const job of emailJobs) {
      const delay = Math.max(0, job.scheduledFor.getTime() - Date.now());
      await emailQueue.add(
        "send-email",
        {
          emailJobId: job.id,
          to: job.recipientEmail,
          subject,
          body,
        },
        {
          jobId: job.id, // idempotency: DB row id === BullMQ job id
          delay,
        }
      );
    }

    return { campaignId, emailJobs };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
'@ | Out-File -FilePath services\campaignService.ts -Encoding utf8