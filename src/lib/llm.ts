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
}): Promise<{ text: string }> {
  const { prompt, system } = options;
  
  try {
    const result = await generateTextWithFallback(
      prompt,
      system
    );
    
    return { text: result };
  } catch (error) {
    console.error('[LLM] Failed to generate text', error);
    throw error;
  }
}

// Re-export types
export type { LLMConfig } from './llm-service';
