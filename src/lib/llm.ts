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
  const { prompt, system, timeout = 45000 } = options;
  
  try {
    // Add timeout for Vercel compatibility (45s to stay under 60s function limit)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('LLM request timeout')), timeout);
    });
    
    const result = await Promise.race([
      generateTextWithFallback(prompt, system),
      timeoutPromise
    ]);
    
    return { text: result };
  } catch (error) {
    console.error('[LLM] Failed to generate text', error);
    throw error;
  }
}

// Re-export types
export type { LLMConfig } from './llm-service';
