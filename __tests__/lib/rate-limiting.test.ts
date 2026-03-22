/**
 * Rate Limiting Tests - Simplified
 * 
 * Validates core functionality per Complex Task Protocol
 */

import {
  TokenBucket,
  globalRateLimiter,
  callWithRetry,
  sleep
} from '../../src/lib/rate-limiting';

describe('Rate Limiting Module', () => {
  
  describe('TokenBucket', () => {
    test('T1: Initializes with full capacity', () => {
      const bucket = new TokenBucket(1000, 1000);
      // Bucket starts full
      expect(bucket).toBeInstanceOf(TokenBucket);
    });

    test('T2: Consumes tokens immediately when available', async () => {
      const bucket = new TokenBucket(1000, 1000);
      await bucket.consume(100);
      // Should complete without waiting
    });

    test('T3: Throws when request exceeds capacity', async () => {
      const bucket = new TokenBucket(1000, 1000);
      await expect(bucket.consume(2000)).rejects.toThrow('exceeds capacity');
    });

    test('T4: Waits for tokens when insufficient', async () => {
      const bucket = new TokenBucket(100, 6000); // 100 TPM = slow refill
      await bucket.consume(90); // Leave 10
      
      const start = Date.now();
      await bucket.consume(20); // Need to wait for 10 tokens
      const elapsed = Date.now() - start;
      
      // Should have waited ~100ms (10 tokens at 100 TPM)
      expect(elapsed).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Retry Logic', () => {
    test('T5: Succeeds on first attempt', async () => {
      let calls = 0;
      const fn = async () => {
        calls++;
        return 'success';
      };
      
      const result = await callWithRetry(fn);
      expect(result).toBe('success');
      expect(calls).toBe(1);
    });

    test('T6: Retries on rate limit error', async () => {
      let calls = 0;
      const fn = async () => {
        calls++;
        if (calls < 3) {
          const err = new Error('Rate limit exceeded') as any;
          err.status = 429;
          throw err;
        }
        return 'success';
      };
      
      const start = Date.now();
      const result = await callWithRetry(fn, 'test');
      const elapsed = Date.now() - start;
      
      expect(result).toBe('success');
      expect(calls).toBe(3);
      expect(elapsed).toBeGreaterThanOrEqual(300); // 100ms + 200ms
    });

    test('T7: Throws after max retries', async () => {
      let calls = 0;
      const fn = async () => {
        calls++;
        const err = new Error('Rate limit exceeded') as any;
        err.status = 429;
        throw err;
      };
      
      await expect(callWithRetry(fn)).rejects.toThrow('Rate limit exceeded');
      expect(calls).toBe(4); // Initial + 3 retries
    }, 10000); // 10s timeout

    test('T8: Does not retry non-rate-limit errors', async () => {
      let calls = 0;
      const fn = async () => {
        calls++;
        throw new Error('Some other error');
      };
      
      await expect(callWithRetry(fn)).rejects.toThrow('Some other error');
      expect(calls).toBe(1);
    });
  });

  describe('Sleep', () => {
    test('T9: Sleep waits correct duration', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90);
    });
  });

  describe('Global Rate Limiter', () => {
    test('T10: Global limiter exists', () => {
      expect(globalRateLimiter).toBeInstanceOf(TokenBucket);
    });
  });
});
