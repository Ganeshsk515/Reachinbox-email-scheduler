import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { pool } from "./db/client";
import { campaignsRouter } from "./routes/campaigns";
import { emailsRouter } from "./routes/emails";
import { logger } from "./lib/logger";
import { initializeSchema } from "./db/initializeSchema";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    logger.error("DB health check failed", err);
    res.status(500).json({ status: "error", db: "unreachable" });
  }
});

app.use("/api/campaigns", campaignsRouter);
app.use("/api/emails", emailsRouter);

let server: ReturnType<typeof app.listen>;

async function start() {
  await initializeSchema();
  server = app.listen(env.port, () => {
    logger.info(`Server running on http://localhost:${env.port}`);
  });
}

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  server?.close(() => logger.info("HTTP server closed"));

  try {
    await pool.end();
    logger.info("Postgres pool closed");
  } catch (err) {
    logger.error("Error closing Postgres pool", err);
  }

  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((err) => {
  logger.error("Failed to start server", err);
  process.exit(1);
});
