const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
export const isRedisConfigured = !!(redisUrl && redisToken);

let ratelimit: any = null;
let ratelimitInitialized = false;

function getRatelimit(): any {
  if (ratelimitInitialized) return ratelimit;
  ratelimitInitialized = true;

  if (!isRedisConfigured) return null;

  try {
    const { Ratelimit } = eval('require("@upstash/ratelimit")');
    const { Redis } = eval('require("@upstash/redis")');
    ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      analytics: true,
      prefix: "ratelimit",
    });
  } catch {
    ratelimit = null;
  }

  return ratelimit;
}

export async function rateLimit(identifier: string) {
  const limiter = getRatelimit();

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
