import { z } from 'zod';

/**
 * Schema for individual prompt definitions
 */
export const promptSchema = z.object({
  system: z.string().min(1).describe('System role/persona for the LLM'),
  template: z.string().min(1).describe('Full prompt template with variables'),
  variables: z.array(z.string()).min(1).describe('List of template variables used')
});

/**
 * Schema for the entire prompts configuration
 */
export const promptsConfigSchema = z.object({
  queryOptimization: z.string().min(1).describe('Boolean query generation prompt'),
  contentAssessment: z.string().min(1).describe('Content evaluation prompt'),
  summaryGeneration: z.string().min(1).describe('Paper summary generation prompt'),
  tagSuggestion: z.string().min(1).describe('Tag suggestion prompt'),
  digestGeneration: promptSchema.describe('Digest generation prompt with structured format')
});

/**
 * TypeScript type for prompts configuration
 */
export type PromptsConfig = z.infer<typeof promptsConfigSchema>;

/**
 * TypeScript type for structured prompt
 */
export type PromptDefinition = z.infer<typeof promptSchema>;
