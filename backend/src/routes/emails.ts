import { Router } from "express";
import { getEmailJobsByStatus } from "../db/campaignRepo";
import { logger } from "../lib/logger";

export const emailsRouter = Router();

emailsRouter.get("/", async (req, res) => {
  try {
    const status = String(req.query.status ?? "scheduled");
    const requestedLimit = Number(req.query.limit ?? 1000);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 1000)
      : 1000;
    const offset = Number(req.query.offset ?? 0);

    if (!["scheduled", "sent", "failed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status filter" });
    }

    const jobs = await getEmailJobsByStatus(status, limit, offset);
    res.json({ jobs });
  } catch (err) {
    logger.error("Failed to fetch email jobs:", err);
    res.status(500).json({ error: "Failed to fetch email jobs" });
  }
});
