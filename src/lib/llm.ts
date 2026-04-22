// src/lib/llm.ts
// LLM Adapter - Simplified interface for digest generation

import { generateTextWithFallback } from './llm-service';

/**
 * Generate text using LLM
 * Simplified interface for digest generation
 */
export async function generateText(options: {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}): Promise<{ text: string }> {
  const { prompt, system, timeout = 120000 } = options;
  
  console.log(`[LLM] Starting generateText with timeout ${timeout}ms, prompt length: ${prompt.length}`);
  
  try {
    // Add timeout for Vercel compatibility (30s to stay well under function limit)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        console.error(`[LLM] Timeout after ${timeout}ms`);
        reject(new Error(`LLM request timeout after ${timeout}ms`));
      }, timeout);
    });
    
    const startTime = Date.now();
    const result = await Promise.race([
      generateTextWithFallback(prompt, system),
      timeoutPromise
    ]);
    const duration = Date.now() - startTime;
    
    console.log(`[LLM] Success in ${duration}ms, result length: ${result.length}`);
    return { text: result };
  } catch (error) {
    console.error('[LLM] Failed to generate text', error);
    throw error;
  }
}

// Re-export types
export type { LLMConfig } from './llm-service';
