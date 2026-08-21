import { Router } from "express";
import { createCampaign, createEmailJob, getCampaignById } from "../db/campaignRepo";
import { emailQueue } from "../queue/emailQueue";
import { createCampaignSchema } from "../validation/campaignSchema";
import { logger } from "../lib/logger";

export const campaignsRouter = Router();

campaignsRouter.post("/", async (req, res) => {
  const parsed = createCampaignSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const {
    subject,
    body,
    senderId,
    delayBetweenMs,
    maxEmailsPerHour,
    startTime,
    createdBy,
    recipients,
  } = parsed.data;

  try {
    const campaignId = await createCampaign({
      subject,
      body,
      senderId,
      delayBetweenMs,
      maxEmailsPerHour,
      startTime: new Date(startTime ?? Date.now()),
      createdBy: createdBy ?? "unknown",
    });

    const start = new Date(startTime ?? Date.now()).getTime();

    for (let i = 0; i < recipients.length; i++) {
      const scheduledFor = new Date(start + i * delayBetweenMs);

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
          senderId,
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

    logger.info(`Campaign ${campaignId} created with ${recipients.length} emails scheduled`);

    return res.status(201).json({
      campaignId,
      emailsScheduled: recipients.length,
    });
  } catch (err) {
    logger.error("Failed to create campaign", err);
    return res.status(500).json({
      error: "Failed to create campaign",
    });
  }
});

campaignsRouter.get("/:id", async (req, res) => {
  try {
    const campaign = await getCampaignById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    res.json(campaign);
  } catch (err) {
    logger.error("Failed to fetch campaign", err);
    res.status(500).json({ error: "Failed to fetch campaign" });
  }
});