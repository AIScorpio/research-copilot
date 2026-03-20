import { logger } from './logger';
import rateLimitsConfig from '../../config/rate-limits.json';

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRatePerMs: number;

  constructor(capacity: number, refillRatePerMinute: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRatePerMs = refillRatePerMinute / 60000;
    this.lastRefill = Date.now();
  }

  async consume(tokensNeeded: number): Promise<void> {
    if (tokensNeeded > this.capacity) {
      throw new Error(`Token request (${tokensNeeded}) exceeds capacity (${this.capacity})`);
    }

    this.refill();

    if (this.tokens >= tokensNeeded) {
      this.tokens -= tokensNeeded;
      return;
    }

    const waitMs = Math.ceil((tokensNeeded - this.tokens) / this.refillRatePerMs);
    logger.debug(`[RateLimit] Waiting ${waitMs}ms`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
    return this.consume(tokensNeeded);
  }

  private refill(): void {
    const elapsed = Date.now() - this.lastRefill;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefill = Date.now();
  }
}

export const globalRateLimiter = new TokenBucket(
  rateLimitsConfig.global.tpm,
  rateLimitsConfig.global.tpm
);

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const RETRY_CONFIG = {
  maxRetries: rateLimitsConfig.retry.maxRetries,
  baseDelay: rateLimitsConfig.retry.baseDelayMs,
  maxDelay: rateLimitsConfig.retry.maxDelayMs
};

export async function callWithRetry<T>(callFn: () => Promise<T>, itemName?: string): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await callFn();
    } catch (error) {
      lastError = error as Error;
      const err = error as { status?: number; code?: string; message?: string };
      const isRateLimit = err?.status === 429 || err?.message?.includes('Rate limit');
      
      if (!isRateLimit || attempt >= RETRY_CONFIG.maxRetries) {
        throw lastError;
      }
      
      const delay = Math.min(RETRY_CONFIG.baseDelay * Math.pow(2, attempt), RETRY_CONFIG.maxDelay);
      logger.warn(`[Retry] ${itemName || 'request'} attempt ${attempt + 1}, wait ${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError!;
}
