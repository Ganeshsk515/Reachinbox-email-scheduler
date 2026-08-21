import { readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./client";

export async function initializeSchema() {
  const schemaPath = path.join(process.cwd(), "src", "db", "schema.sql");
  const schema = await readFile(schemaPath, "utf8");
  await pool.query(schema);
}
