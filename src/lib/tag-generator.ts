/**
 * Tag Generator - Uses LLM to generate tags based on config/prompts.json
 * LLM only - no fallback. Returns empty array if LLM not available.
 */

import { generateJSONWithFallback, isLLMConfigured } from './llm-service';
import { logger } from './logger';
import { promises as fs } from 'fs';
import { join } from 'path';
import { normalizeCategory } from './source-config';

export interface GeneratedTag {
    name: string;
    type: 'Academic' | 'Industrial' | 'User Defined';
    category: string;
}

export interface TagGenerationResult {
    tags: GeneratedTag[];
    confidence: number;
    reasoning: string;
}

// Cache for prompt config
let cachedPromptConfig: Record<string, string> | null = null;
let promptConfigLastRead: number = 0;
const PROMPT_CACHE_TTL = 60000; // 1 minute cache

/**
 * Load prompt configuration from config/prompts.json
 */
async function loadPromptConfig(): Promise<Record<string, string>> {
    const now = Date.now();
    if (cachedPromptConfig && (now - promptConfigLastRead) < PROMPT_CACHE_TTL) {
        return cachedPromptConfig;
    }

    try {
        const configPath = join(process.cwd(), 'config', 'prompts.json');
        const configData = await fs.readFile(configPath, 'utf-8');
        cachedPromptConfig = JSON.parse(configData);
        promptConfigLastRead = now;
        logger.debug('[TagGenerator] Loaded prompt config from config/prompts.json');
        return cachedPromptConfig || {};
    } catch (error) {
        logger.error('[TagGenerator] Failed to load config/prompts.json', { error });
        return {};
    }
}

/**
 * Get tag suggestion prompt from config
 */
async function getTagSuggestionPrompt(): Promise<string> {
    const config = await loadPromptConfig();
    const prompt = config.tagSuggestion;
    if (!prompt) {
        logger.error('[TagGenerator] tagSuggestion prompt not found in config');
        throw new Error('Tag suggestion prompt not configured');
    }
    logger.debug('[TagGenerator] Using tagSuggestion prompt from config');
    return prompt;
}

/**
 * Generate tags using LLM based on paper content
 * Returns empty array if LLM not configured or call fails
 */
export async function generateTagsWithLLM(
    title: string,
    abstract: string,
    existingTags?: string[]
): Promise<TagGenerationResult> {
    // LLM not configured - return empty
    if (!isLLMConfigured()) {
        logger.warn('[TagGenerator] LLM not configured, skipping tag generation', { title: title.substring(0, 50) });
        return {
            tags: [],
            confidence: 0,
            reasoning: 'LLM not configured - tags can be added later via paper card'
        };
    }

    try {
        const systemPrompt = await getTagSuggestionPrompt();

        const existingTagsNote = existingTags?.length 
            ? `\nExisting tags (avoid duplicates): ${existingTags.join(', ')}` 
            : '';

        const prompt = `Generate tags for the following paper:

TITLE: ${title}

ABSTRACT: ${abstract || 'No abstract available'}${existingTagsNote}`;

        logger.info('[TagGenerator] Calling LLM for tag generation', { title: title.substring(0, 50) });

        const result = await generateJSONWithFallback<GeneratedTag[]>(prompt, systemPrompt);

        // Validate and normalize tags
        const validTags = result
            .filter(tag => tag.name && tag.category)
            .map(tag => ({
                name: tag.name.toLowerCase().replace(/\s+/g, '-'),
                type: tag.type || 'Industrial',
                category: normalizeCategory(tag.category)
            }));

        logger.info('[TagGenerator] Tags generated successfully', {
            title: title.substring(0, 50),
            tagCount: validTags.length,
            tags: validTags.map(t => t.name),
            categories: validTags.map(t => t.category)
        });

        return {
            tags: validTags,
            confidence: 0.8,
            reasoning: `Generated ${validTags.length} tags using LLM based on content analysis`
        };

    } catch (error) {
        logger.error('[TagGenerator] LLM tag generation failed', { 
            title: title.substring(0, 50), 
            error: error instanceof Error ? error.message : error 
        });
        return {
            tags: [],
            confidence: 0,
            reasoning: 'LLM tag generation failed - tags can be added later via paper card'
        };
    }
}

// Export config loader for external use
export { loadPromptConfig };
