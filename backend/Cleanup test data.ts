import { pool } from "./src/db/client";

async function main() {
  const emailJobs = await pool.query(
    `DELETE FROM email_jobs WHERE recipient_email LIKE 'test%@example.com' RETURNING id, recipient_email`
  );
  console.log("Deleted email_jobs:", emailJobs.rows);

  const campaigns = await pool.query(
    `DELETE FROM campaigns WHERE subject LIKE 'Rate limit test%' RETURNING id, subject`
  );
  console.log("Deleted campaigns:", campaigns.rows);

  process.exit(0);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});