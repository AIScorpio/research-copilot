import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  analytics: true,
  prefix: "ratelimit",
});

export async function rateLimit(identifier: string) {
  const { success, limit, remaining, reset } = await ratelimit.limit(identifier);
  
  if (!success) {
    return {
      allowed: false,
      limit,
      remaining,
      reset
    };
  }
  
  return {
    allowed: true,
    limit,
    remaining,
    reset
  };
}

export async function getRateLimitHeaders(identifier: string) {
  const { limit, remaining, reset } = await rateLimit(identifier);

  return {
    "X-RateLimit-Limit": limit.toString(),
    "X-RateLimit-Remaining": remaining.toString(),
    "X-RateLimit-Reset": new Date(reset).toISOString()
  };
}
