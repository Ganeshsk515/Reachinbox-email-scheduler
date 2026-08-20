import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  redisHost: process.env.REDIS_HOST ?? "localhost",
  redisPort: Number(process.env.REDIS_PORT ?? 6379),
  etherealHost: required("ETHEREAL_HOST"),
  etherealPort: Number(process.env.ETHEREAL_PORT ?? 587),
  etherealUser: required("ETHEREAL_USER"),
  etherealPass: required("ETHEREAL_PASS"),
};