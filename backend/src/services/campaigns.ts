New-Item -ItemType Directory -Force -Path routes | Out-Null

@'
import { Router } from "express";
import { createCampaign } from "../services/campaignService";

export const campaignsRouter = Router();

campaignsRouter.post("/", async (req, res) => {
  try {
    const { subject, body, senderId, delayBetweenMs, maxEmailsPerHour, startTime, recipients } = req.body;

    if (!subject || !body || !startTime || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        error: "subject, body, startTime, and a non-empty recipients array are required",
      });
    }

    const result = await createCampaign({
      subject,
      body,
      senderId,
      delayBetweenMs: Number(delayBetweenMs ?? 2000),
      maxEmailsPerHour: Number(maxEmailsPerHour ?? 200),
      startTime,
      recipients,
    });

    res.status(201).json(result);
  } catch (err) {
    console.error("[POST /api/campaigns] error:", err);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});
'@ | Out-File -FilePath routes\campaigns.ts -Encoding utf8