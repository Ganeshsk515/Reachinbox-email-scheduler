import { randomUUID } from "crypto";
import { pool } from "./client";

export interface EmailJobRow {
  id: string;
  campaign_id: string;
  recipient_email: string;
  status: string;
  scheduled_for: string;
  bullmq_job_id: string | null;
}

export interface PendingEmailJobWithCampaign {
  id: string;
  recipient_email: string;
  scheduled_for: string;
  bullmq_job_id: string | null;
  subject: string;
  body: string;
  sender_id: string;
}

export async function createCampaign(params: {
  subject: string;
  body: string;
  senderId: string;
  delayBetweenMs: number;
  maxEmailsPerHour: number;
  startTime: Date;
  createdBy: string;
}): Promise<string> {
  const result = await pool.query(
    `INSERT INTO campaigns (subject, body, sender_id, delay_between_ms, max_emails_per_hour, start_time, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      params.subject,
      params.body,
      params.senderId,
      params.delayBetweenMs,
      params.maxEmailsPerHour,
      params.startTime,
      params.createdBy,
    ]
  );
  return result.rows[0].id;
}

export async function createEmailJob(params: {
  campaignId: string;
  recipientEmail: string;
  scheduledFor: Date;
}): Promise<EmailJobRow> {
  // Generate the id client-side so we can set bullmq_job_id = id in the same insert
  // (the row's own id is used as the initial BullMQ jobId — see worker.ts / campaigns.ts)
  const id = randomUUID();

  const result = await pool.query(
    `INSERT INTO email_jobs (id, campaign_id, recipient_email, scheduled_for, bullmq_job_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, params.campaignId, params.recipientEmail, params.scheduledFor,id]
  );
  return result.rows[0];
}

export async function markEmailJobSent(id: string) {
  await pool.query(
    `UPDATE email_jobs SET status = 'sent', sent_at = now() WHERE id = $1`,
    [id]
  );
}

export async function markEmailJobFailed(id: string, errorMsg: string) {
  await pool.query(
    `UPDATE email_jobs SET status = 'failed', error = $2, attempts = attempts + 1 WHERE id = $1`,
    [id, errorMsg]
  );
}

export async function updateEmailJobBullmqId(id: string, newBullmqJobId: string) {
  await pool.query(
    `UPDATE email_jobs SET bullmq_job_id = $2 WHERE id = $1`,
    [id, newBullmqJobId]
  );
}

export async function getEmailJobById(id: string): Promise<EmailJobRow | null> {
  const result = await pool.query(`SELECT * FROM email_jobs WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

// Used by reconcile.ts on boot — joins campaigns so the worker has everything
// it needs (subject, body, sender_id) to safely re-enqueue a job.
export async function getPendingEmailJobsWithCampaignInfo(): Promise<PendingEmailJobWithCampaign[]> {
  const result = await pool.query(
    `SELECT
       ej.id,
       ej.recipient_email,
       ej.scheduled_for,
       ej.bullmq_job_id,
       c.subject,
       c.body,
       c.sender_id
     FROM email_jobs ej
     JOIN campaigns c ON c.id = ej.campaign_id
     WHERE ej.status = 'scheduled'`
  );
  return result.rows;
}