import { Router } from "express";
import { createCampaign, createEmailJob } from "../db/campaignRepo";
import { emailQueue } from "../queue/emailQueue";

export const campaignsRouter = Router();

campaignsRouter.post("/", async (req, res) => {
  try {
    const {
      subject,
      body,
      senderId,
      delayBetweenMs,
      maxEmailsPerHour,
      startTime,
      createdBy,
      recipients, // array of email strings
    } = req.body;

    if (!subject || !body || !senderId || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const campaignId = await createCampaign({
      subject,
      body,
      senderId,
      delayBetweenMs: delayBetweenMs ?? 2000,
      maxEmailsPerHour: maxEmailsPerHour ?? 100,
      startTime: new Date(startTime ?? Date.now()),
      createdBy: createdBy ?? "unknown",
    });

    const start = new Date(startTime ?? Date.now()).getTime();

    for (let i = 0; i < recipients.length; i++) {
      const scheduledFor = new Date(start + i * (delayBetweenMs ?? 2000));

      const job = await createEmailJob({
        campaignId,
        recipientEmail: recipients[i],
        scheduledFor,
      });

      const delayMs = scheduledFor.getTime() - Date.now();

      await emailQueue.add(
        "send-email",
        {
          emailJobId: job.id,
          to: job.recipient_email,
          subject,
          body,
        },
        {
          jobId: job.id, // idempotency key — BullMQ dedupes on this
          delay: Math.max(delayMs, 0),
        }
      );
    }

    res.status(201).json({ campaignId, emailsScheduled: recipients.length });
  } catch (err) {
    console.error("Failed to create campaign:", err);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});