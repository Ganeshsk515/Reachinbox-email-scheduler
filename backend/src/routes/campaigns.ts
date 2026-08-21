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
      recipients,
    } = req.body;

    // Validate required fields
    if (
      !subject ||
      !body ||
      !senderId ||
      !Array.isArray(recipients) ||
      recipients.length === 0
    ) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    // Create campaign
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
    const interval = delayBetweenMs ?? 2000;

    // Schedule emails
    for (let i = 0; i < recipients.length; i++) {
      const scheduledFor = new Date(start + i * interval);

      const emailJob = await createEmailJob({
        campaignId,
        recipientEmail: recipients[i],
        scheduledFor,
      });

      const delayMs = Math.max(scheduledFor.getTime() - Date.now(), 0);

      await emailQueue.add(
        "send-email",
        {
          emailJobId: emailJob.id,
          senderId, // Pass senderId to the worker
          to: emailJob.recipient_email,
          subject,
          body,
        },
        {
          jobId: emailJob.id,
          delay: delayMs,
        }
      );
    }

    return res.status(201).json({
      campaignId,
      emailsScheduled: recipients.length,
    });
  } catch (err) {
    console.error("Failed to create campaign:", err);
    return res.status(500).json({
      error: "Failed to create campaign",
    });
  }
});