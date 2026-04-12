const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
export const isRedisConfigured = !!(redisUrl && redisToken);

let cachedRatelimit: any = null;

async function getRatelimit() {
  if (cachedRatelimit) return cachedRatelimit;
  if (!isRedisConfigured) return null;

  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    cachedRatelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      analytics: true,
      prefix: "ratelimit",
    });
    return cachedRatelimit;
  } catch {
    return null;
  }
}

export async function rateLimit(identifier: string) {
  const limiter = await getRatelimit();

  if (!limiter) {
    return {
      allowed: true,
      limit: 100,
      remaining: 100,
      reset: Date.now() + 60000
    };
  }

  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  
  if (!success) {
    return { allowed: false, limit, remaining, reset };
  }
  
  return { allowed: true, limit, remaining, reset };
}

export async function getRateLimitHeaders(identifier: string) {
  const { limit, remaining, reset } = await rateLimit(identifier);

  return {
    "X-RateLimit-Limit": limit.toString(),
    "X-RateLimit-Remaining": remaining.toString(),
    "X-RateLimit-Reset": new Date(reset).toISOString()
  };
}
