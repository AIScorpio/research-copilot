import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Check if Redis is configured
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const isRedisConfigured = redisUrl && redisToken;

// Only create rate limiter if Redis is configured
const ratelimit = isRedisConfigured 
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      analytics: true,
      prefix: "ratelimit",
    })
  : null;

export async function rateLimit(identifier: string) {
  // Skip rate limiting if Redis is not configured
  if (!ratelimit) {
    return {
      allowed: true,
      limit: 100,
      remaining: 100,
      reset: Date.now() + 60000
    };
  }

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
