import { pool } from "./client";

export interface EmailJobRow {
  id: string;
  campaign_id: string;
  recipient_email: string;
  status: string;
  scheduled_for: string;
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
  const result = await pool.query(
    `INSERT INTO email_jobs (campaign_id, recipient_email, scheduled_for)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [params.campaignId, params.recipientEmail, params.scheduledFor]
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

export async function getEmailJobById(id: string): Promise<EmailJobRow | null> {
  const result = await pool.query(`SELECT * FROM email_jobs WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function updateEmailJobBullmqId(id: string, bullmqJobId: string) {
  await pool.query(
    `UPDATE email_jobs SET bullmq_job_id = $2 WHERE id = $1`,
    [id, bullmqJobId]
  );
}

export async function getEmailJobsByStatus(status: string, limit = 50, offset = 0) {
  const result = await pool.query(
    `SELECT ej.id, ej.recipient_email, ej.status, ej.scheduled_for, ej.sent_at, c.subject
     FROM email_jobs ej
     JOIN campaigns c ON c.id = ej.campaign_id
     WHERE ej.status = $1
     ORDER BY ej.scheduled_for DESC
     LIMIT $2 OFFSET $3`,
    [status, limit, offset]
  );
  return result.rows;
}

export async function getCampaignById(id: string) {
  const result = await pool.query(`SELECT * FROM campaigns WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function getPendingEmailJobsWithCampaignInfo() {
  const result = await pool.query(
    `SELECT
       ej.id,
       ej.recipient_email,
       ej.status,
       ej.scheduled_for,
       ej.bullmq_job_id,
       c.subject,
       c.body,
       c.sender_id,
       c.max_emails_per_hour
     FROM email_jobs ej
     JOIN campaigns c ON c.id = ej.campaign_id
     WHERE ej.status = 'scheduled'`
  );
  return result.rows;
}

export async function getSenderById(id: string) {
  const result = await pool.query(
    `SELECT id, name, smtp_user, smtp_pass FROM senders WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function rescheduleEmailJob(id: string, bullmqJobId: string, scheduledFor: Date) {
  await pool.query(
    `UPDATE email_jobs SET bullmq_job_id = $2, scheduled_for = $3 WHERE id = $1`,
    [id, bullmqJobId, scheduledFor]
  );
}
