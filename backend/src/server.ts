import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { pool } from "./db/client";
import { campaignsRouter } from "./routes/campaigns";
import { emailsRouter } from "./routes/emails";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    console.error("DB connection error:", err);
    res.status(500).json({ status: "error", db: "unreachable" });
  }
});

app.use("/api/campaigns", campaignsRouter);
app.use("/api/emails", emailsRouter);

app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
});