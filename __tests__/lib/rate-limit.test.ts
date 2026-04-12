import { jest } from '@jest/globals';

jest.mock('@upstash/ratelimit', () => {
  const mockCtor = jest.fn().mockImplementation(() => ({ limit: jest.fn() }));
  mockCtor.slidingWindow = jest.fn(() => ({}));
  return { Ratelimit: mockCtor };
});
jest.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: jest.fn(() => ({})),
  },
}));

describe('Rate Limit Module', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  describe('isRedisConfigured export', () => {
    it('should be false when Redis env vars are missing', async () => {
      const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
      const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const { isRedisConfigured } = await import('@/lib/rate-limit');
      expect(isRedisConfigured).toBe(false);

      process.env.UPSTASH_REDIS_REST_URL = originalUrl;
      process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    });

    it('should be true when both Redis env vars are set', async () => {
      const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
      const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      const { isRedisConfigured } = await import('@/lib/rate-limit');
      expect(isRedisConfigured).toBe(true);

      process.env.UPSTASH_REDIS_REST_URL = originalUrl;
      process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    });
  });

  describe('rateLimit function', () => {
    it('should return allowed=true with defaults when Redis not configured', async () => {
      const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
      const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const { rateLimit } = await import('@/lib/rate-limit');
      const result = await rateLimit('test-ip');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(100);
      expect(result.reset).toBeGreaterThan(Date.now());

      process.env.UPSTASH_REDIS_REST_URL = originalUrl;
      process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    });
  });
});
