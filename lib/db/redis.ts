// Upstash Redis singleton. Used for rate limits, fill-polling cursors, and idempotency keys.

import { Redis } from "@upstash/redis";

let cached: Redis | null = null;

export function getRedis(): Redis {
  if (cached) return cached;
  cached = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return cached;
}
