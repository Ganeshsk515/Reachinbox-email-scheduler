import { redisConnection } from "./connection";
import { env } from "../config/env";

export async function tryConsumeRateLimit(senderId: string) {
  const hourBucket = new Date().toISOString().slice(0, 13);
  const key = `rate:${senderId}:${hourBucket}`;

  const count = await redisConnection.incr(key);

  if (count === 1) {
    await redisConnection.expire(key, 3600);
  }

  if (count > env.maxEmailsPerHourPerSender) {
    return {
      allowed: false,
      retryAt: getStartOfNextHour(),
    };
  }

  return {
    allowed: true,
  };
}

export function getStartOfNextHour() {
  const nextHour = new Date();

  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);

  return nextHour;
}