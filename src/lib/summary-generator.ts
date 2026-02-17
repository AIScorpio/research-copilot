/**
 * Summary Generator - Generate AI summaries for research papers
 * Uses config/prompts.json as golden source for system prompts
 */

import { join } from 'path';
import { promises as fs } from 'fs';
import { generateTextWithFallback, isLLMConfigured } from './llm-service';
import { logger } from './logger';

export { generateSummary };

let cachedPromptConfig: Record<string, string> | null = null;
let promptConfigLastRead: number = 0;
const PROMPT_CACHE_TTL = 60000;

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
        logger.debug('[SummaryGenerator] Loaded prompt config from config/prompts.json');
        return cachedPromptConfig || {};
    } catch (error) {
        logger.warn('[SummaryGenerator] Failed to load config/prompts.json, using fallback prompt', { error });
        return {};
    }
}

async function getSummaryPrompt(): Promise<string> {
    const config = await loadPromptConfig();
    return config['summaryGeneration'] || getFallbackSummaryPrompt();
}

function getFallbackSummaryPrompt(): string {
    return `Role: Technical Research Analyst

Task: Generate a concise technical summary for research papers.

## Requirements
1. Accurately describe the core methodology and contribution
2. Report key findings and metrics ONLY if explicitly stated in the paper
3. Do NOT fabricate numbers, metrics, or applications not mentioned in the paper
4. Identify potential application domains based on paper content (if any)
5. Keep it to 2-3 sentences maximum`;
}

async function generateSummary(title: string, abstract: string): Promise<string> {
    if (!isLLMConfigured()) {
        return `Summary for "${title}": This paper explores technical advancements and potential applications in its field.`;
    }

    try {
        const systemPrompt = await getSummaryPrompt();
        
        const prompt = `Generate an accurate technical summary for the following paper.
Only include facts, metrics, and applications explicitly stated in the paper.
Do NOT fabricate numbers or applications not mentioned in the paper.

TITLE: ${title}

ABSTRACT: ${abstract || "No abstract available"}`;

        return await generateTextWithFallback(prompt, systemPrompt);
    } catch (error) {
        logger.warn('[SummaryGenerator] LLM failed, using fallback', { error });
        return `Summary for "${title}": This paper explores technical advancements and potential applications in its field.`;
    }
}
