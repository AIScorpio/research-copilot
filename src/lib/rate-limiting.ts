/**
 * Rate Limiting Module - Token Bucket Algorithm
 * 
 * Protects against 429 errors by controlling token consumption rate
 * for LLM API calls (Groq, ZhipuAI, etc.)
 * 
 * DYNAMIC CONFIGURATION: All rate limits and fallback providers
 * are loaded from environment variables / settings, NOT hardcoded.
 */

import { logger } from './logger';
import { LLMProvider } from './llm-service';

/**
 * Token Bucket for rate limiting
 * Refills tokens at a constant rate up to capacity
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRatePerMs: number;

  constructor(capacity: number, refillRatePerMinute: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRatePerMs = refillRatePerMinute / 60000; // Convert to per-ms
    this.lastRefill = Date.now();
  }

  /**
   * Consume tokens from the bucket
   * If insufficient tokens, waits until enough are available
   */
  async consume(tokensNeeded: number): Promise<void> {
    // Prevent infinite loop: reject requests exceeding bucket capacity
    if (tokensNeeded > this.capacity) {
      throw new Error(
        `Token request (${tokensNeeded}) exceeds bucket capacity (${this.capacity}). ` +
        `Consider reducing batch size or using a model with higher rate limits.`
      );
    }

    this.refill();

    if (this.tokens >= tokensNeeded) {
      this.tokens -= tokensNeeded;
      return;
    }

    // Calculate wait time
    const tokensToWait = tokensNeeded - this.tokens;
    const waitMs = Math.ceil(tokensToWait / this.refillRatePerMs);

    logger.debug(`[RateLimit] Waiting ${waitMs}ms for ${tokensToWait} tokens`, {
      needed: tokensNeeded,
      available: this.tokens,
      waitMs
    });

    await sleep(waitMs);
    return this.consume(tokensNeeded);
  }

  /**
   * Try to consume tokens without waiting
   * Returns true if successful, false if insufficient tokens
   */
  tryConsume(tokensNeeded: number): boolean {
    this.refill();

    if (this.tokens >= tokensNeeded) {
      this.tokens -= tokensNeeded;
      return true;
    }

    return false;
  }

  /**
   * Get current token count (for monitoring)
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRatePerMs;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

/**
 * Rate limit configuration for a model
 */
export interface ModelRateLimit {
  capacity: number;      // Token bucket capacity (TPM)
  refillRate: number;    // Tokens per minute
  rpm?: number;          // Requests per minute (optional)
}

/**
 * DYNAMIC: Load rate limits from environment variables
 * Format: RATE_LIMIT_{PROVIDER}_{MODEL}_TPM=10000
 * Example: RATE_LIMIT_GROQ_KIMI_K2_TPM=10000
 */
function loadRateLimitsFromEnv(): Record<string, ModelRateLimit> {
  const limits: Record<string, ModelRateLimit> = {};
  
  // Default rate limits (can be overridden by env vars)
  const defaults: Record<string, ModelRateLimit> = {
    // Kimi K2 models - 10K TPM
    'moonshotai/kimi-k2-instruct': { capacity: 10000, refillRate: 10000, rpm: 60 },
    'moonshotai/kimi-k2-instruct-0905': { capacity: 10000, refillRate: 10000, rpm: 60 },
    
    // Llama 3.3 70B - 12K TPM
    'llama-3.3-70b-versatile': { capacity: 12000, refillRate: 12000, rpm: 30 },
    
    // Llama 4 models - 30K TPM
    'meta-llama/llama-4-scout-17b-16e-instruct': { capacity: 30000, refillRate: 30000, rpm: 30 },
    'meta-llama/llama-4-maverick-17b-128e-instruct': { capacity: 30000, refillRate: 30000, rpm: 30 },
    
    // Groq Compound - 70K TPM
    'groq/compound': { capacity: 70000, refillRate: 70000, rpm: 30 },
    'groq/compound-mini': { capacity: 70000, refillRate: 70000, rpm: 30 },
    'groq/compound-beta': { capacity: 70000, refillRate: 70000, rpm: 30 },
  };
  
  // Override with environment variables if present
  Object.keys(defaults).forEach(model => {
    const envKey = `RATE_LIMIT_${model.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_TPM`;
    const envValue = process.env[envKey];
    
    if (envValue) {
      const tpm = parseInt(envValue, 10);
      if (!isNaN(tpm)) {
        limits[model] = { ...defaults[model], capacity: tpm, refillRate: tpm };
        logger.info(`[RateLimit] Loaded custom rate limit from env: ${model} = ${tpm} TPM`);
      }
    } else {
      limits[model] = defaults[model];
    }
  });
  
  return limits;
}

/**
 * Global rate limiters registry
 * Dynamically initialized from environment configuration
 */
const rateLimits = loadRateLimitsFromEnv();

export const rateLimiters: Record<string, TokenBucket> = Object.fromEntries(
  Object.entries(rateLimits).map(([model, config]) => [
    model,
    new TokenBucket(config.capacity, config.refillRate)
  ])
);

// Default fallback
rateLimiters['default'] = new TokenBucket(10000, 10000);

/**
 * Get rate limiter for a model
 */
export function getRateLimiter(model: string): TokenBucket {
  return rateLimiters[model] || rateLimiters['default'];
}

/**
 * DYNAMIC: Get fallback provider from settings
 * Reads FALLBACK_PROVIDER and FALLBACK_MODEL from env
 * Falls back to ZhipuAI if not configured
 */
const VALID_PROVIDERS: LLMProvider[] = ['groq', 'openai', 'anthropic', 'ollama', 'lmstudio', 'zhipuai', 'kimi', 'baidu', 'alibaba'];

export function getFallbackConfig(): {
  provider: LLMProvider;
  model: string;
} {
  const envProvider = process.env.FALLBACK_PROVIDER;
  const fallbackProvider: LLMProvider = envProvider && VALID_PROVIDERS.includes(envProvider as LLMProvider)
    ? (envProvider as LLMProvider)
    : 'zhipuai';
  const fallbackModel = process.env.FALLBACK_MODEL || 'glm-4.5';
  
  return {
    provider: fallbackProvider,
    model: fallbackModel
  };
}

/**
 * Estimate tokens for a request
 * Rough estimate: 1 token ≈ 4 characters for English
 */
export function estimateTokens(
  text: string,
  invocationType: 'contentAssessment' | 'tagGeneration' | 'summaryGeneration' | 'queryOptimization'
): number {
  const inputChars = text?.length || 0;
  const inputTokens = Math.ceil(inputChars / 4);
  
  // Output varies by invocation type
  const outputTokens = {
    contentAssessment: 500,
    tagGeneration: 400,
    summaryGeneration: 600,
    queryOptimization: 200,
  };
  
  return inputTokens + outputTokens[invocationType];
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Configuration for batch processing
 */
export interface BatchConfig {
  batchSize: number;           // Number of parallel requests
  interBatchDelay: number;     // ms between batches
  intraBatchDelay: number;     // ms between requests in same batch
  maxConcurrent: number;       // Max parallel requests
}

/**
 * Batch configurations per invocation type
 * DYNAMIC: Can be overridden via environment variables
 */
function loadBatchConfigFromEnv(): Record<string, BatchConfig> {
  const parseEnvInt = (envValue: string | undefined, defaultValue: number): number => {
    if (!envValue) return defaultValue;
    const parsed = parseInt(envValue, 10);
    return isNaN(parsed) || parsed < 0 ? defaultValue : parsed;
  };

  const parseEnv = (prefix: string, defaults: BatchConfig): BatchConfig => {
    return {
      batchSize: parseEnvInt(process.env[`${prefix}_BATCH_SIZE`], defaults.batchSize),
      interBatchDelay: parseEnvInt(process.env[`${prefix}_INTER_BATCH_DELAY`], defaults.interBatchDelay),
      intraBatchDelay: parseEnvInt(process.env[`${prefix}_INTRA_BATCH_DELAY`], defaults.intraBatchDelay),
      maxConcurrent: parseEnvInt(process.env[`${prefix}_MAX_CONCURRENT`], defaults.maxConcurrent),
    };
  };

  return {
    contentAssessment: parseEnv('ASSESSMENT', {
      batchSize: 3,
      interBatchDelay: 2000,
      intraBatchDelay: 800,
      maxConcurrent: 3,
    }),
    tagGeneration: parseEnv('TAGS', {
      batchSize: 5,
      interBatchDelay: 1000,
      intraBatchDelay: 200,
      maxConcurrent: 5,
    }),
    summaryGeneration: parseEnv('SUMMARY', {
      batchSize: 2,
      interBatchDelay: 3000,
      intraBatchDelay: 1000,
      maxConcurrent: 2,
    }),
    queryOptimization: parseEnv('QUERY', {
      batchSize: 1,
      interBatchDelay: 0,
      intraBatchDelay: 0,
      maxConcurrent: 1,
    }),
  };
}

export const BATCH_CONFIGS = loadBatchConfigFromEnv();

/**
 * Retry configuration
 * DYNAMIC: Loaded from environment
 */
function loadRetryConfigFromEnv(): {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
} {
  const parseRetryInt = (envValue: string | undefined, defaultValue: number): number => {
    if (!envValue) return defaultValue;
    const parsed = parseInt(envValue, 10);
    return isNaN(parsed) || parsed < 0 ? defaultValue : parsed;
  };

  return {
    maxRetries: parseRetryInt(process.env.RETRY_MAX_RETRIES, 3),
    baseDelay: parseRetryInt(process.env.RETRY_BASE_DELAY, 1000),
    maxDelay: parseRetryInt(process.env.RETRY_MAX_DELAY, 10000),
  };
}

export const RETRY_CONFIG = loadRetryConfigFromEnv();

/**
 * Process items with batching and rate limiting
 * Applies delays between batches and within batches
 */
export async function processWithBatching<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  config: BatchConfig,
  options?: {
    rateLimiter?: TokenBucket;
    estimateTokens?: (item: T) => number;
    invocationType?: string;
  }
): Promise<R[]> {
  const results: R[] = [];
  const totalBatches = Math.ceil(items.length / config.batchSize);

  logger.info(`[Batching] Starting ${items.length} items in ${totalBatches} batches`, {
    batchSize: config.batchSize,
    totalItems: items.length,
    invocationType: options?.invocationType
  });

  for (let i = 0; i < items.length; i += config.batchSize) {
    const batch = items.slice(i, i + config.batchSize);
    const batchNumber = Math.floor(i / config.batchSize) + 1;

    logger.debug(`[Batching] Processing batch ${batchNumber}/${totalBatches}`, {
      batchItems: batch.length
    });

    // Process batch with intra-batch delays
    const batchPromises = batch.map(async (item, index) => {
      // Stagger requests within batch
      if (index > 0) {
        await sleep(config.intraBatchDelay * index);
      }

      // Wait for rate limiter if configured
      if (options?.rateLimiter && options?.estimateTokens) {
        const tokensNeeded = options.estimateTokens(item);
        await options.rateLimiter.consume(tokensNeeded);
      }

      try {
        const result = await processor(item);
        return result;
      } catch (error) {
        logger.error(`[Batching] Failed to process item in batch ${batchNumber}`, {
          index: i + index,
          error: (error as Error).message
        });
        throw error;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Wait between batches (except last batch)
    if (i + config.batchSize < items.length) {
      logger.debug(`[Batching] Waiting ${config.interBatchDelay}ms before next batch`);
      await sleep(config.interBatchDelay);
    }
  }

  logger.info(`[Batching] Completed ${items.length} items`, {
    totalBatches,
    invocationType: options?.invocationType
  });

  return results;
}

/**
 * Check if error is a rate limit error (429)
 */
interface RateLimitError {
  status?: number;
  code?: string;
  message?: string;
  error?: { code?: string };
}

export function isRateLimitError(error: unknown): boolean {
  const err = error as RateLimitError;
  return err?.status === 429 || 
         err?.code === 'rate_limit_exceeded' ||
         err?.message?.includes('Rate limit') ||
         err?.error?.code === 'rate_limit_exceeded';
}

/**
 * Call function with exponential backoff retry
 * Only retries on 429 rate limit errors
 */
export async function callWithRetry<T>(
  callFn: () => Promise<T>,
  config: { maxRetries: number; baseDelay: number; maxDelay: number } = RETRY_CONFIG,
  context?: { itemName?: string; invocationType?: string }
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await callFn();
    } catch (error) {
      lastError = error as Error;

      // Only retry on rate limit errors
      if (!isRateLimitError(error)) {
        logger.debug(`[Retry] Non-retryable error, throwing immediately`, {
          error: lastError.message,
          itemName: context?.itemName
        });
        throw error;
      }

      // Check if this was the last attempt
      if (attempt >= config.maxRetries) {
        logger.warn(`[Retry] Max retries (${config.maxRetries}) reached for ${context?.itemName || 'item'}`, {
          error: lastError.message
        });
        throw lastError;
      }

      // Calculate exponential backoff delay
      const delay = Math.min(
        config.baseDelay * Math.pow(2, attempt),
        config.maxDelay
      );

      logger.warn(`[Retry] Rate limit hit for ${context?.itemName || 'item'}, ` +
        `attempt ${attempt + 1}/${config.maxRetries}, waiting ${delay}ms`, {
        error: lastError.message,
        invocationType: context?.invocationType
      });

      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Retry loop exited without success or error');
}

/**
 * Process items with full protection: batching + rate limiting + retry
 * This is the main entry point for collection pipeline
 */
export async function processWithProtection<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchConfig: BatchConfig;
    rateLimiter?: TokenBucket;
    estimateTokens?: (item: T) => number;
    invocationType: string;
    enableRetry?: boolean;
  }
): Promise<R[]> {
  const { batchConfig, rateLimiter, estimateTokens, invocationType, enableRetry = true } = options;
  
  // Helper to get item name for logging
  const getItemName = (item: T, index: number): string => {
    if (item && typeof item === 'object' && 'title' in item) {
      return String((item as Record<string, unknown>).title) || `item-${index}`;
    }
    return `item-${index}`;
  };
  
  // Wrap processor with retry if enabled
  const wrappedProcessor = enableRetry
    ? async (item: T): Promise<R> => {
        const itemName = getItemName(item, items.indexOf(item));
        return callWithRetry(
          () => processor(item),
          RETRY_CONFIG,
          { itemName, invocationType }
        );
      }
    : processor;
  
  return processWithBatching(items, wrappedProcessor, batchConfig, {
    rateLimiter,
    estimateTokens,
    invocationType
  });
}