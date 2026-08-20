import IORedis from "ioredis";
import { env } from "../config/env";

export const redisConnection = new IORedis({
  host: env.redisHost,
  port: env.redisPort,
  maxRetriesPerRequest: null,
});