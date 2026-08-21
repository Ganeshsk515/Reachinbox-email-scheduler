import { Router } from "express";
import { getEmailJobsByStatus } from "../db/campaignRepo";

export const emailsRouter = Router();

emailsRouter.get("/", async (req, res) => {
  try {
    const status = String(req.query.status ?? "scheduled");
    const limit = Number(req.query.limit ?? 50);
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