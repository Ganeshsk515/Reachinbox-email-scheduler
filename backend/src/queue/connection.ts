import IORedis from "ioredis";
import { env } from "../config/env";

export const redisConnection = env.redisUrl
  ? new IORedis(env.redisUrl, { maxRetriesPerRequest: null })
  : new IORedis({
      host: env.redisHost,
      port: env.redisPort,
      maxRetriesPerRequest: null,
    });
