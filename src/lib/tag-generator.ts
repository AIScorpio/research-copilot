/**
 * Tag Generator - Uses LLM to generate tags based on settings prompt
 * Replaces hardcoded rules in processor.ts
 */

import { generateJSONWithFallback, isLLMConfigured } from './llm-service';
import { logger } from './logger';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface GeneratedTag {
    name: string;
    type: 'Academic' | 'Industrial' | 'User Defined';
    category?: string;
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
        logger.warn('[TagGenerator] Failed to load config/prompts.json, using fallback', { error });
        return {};
    }
}

/**
 * Get tag suggestion prompt from config or fallback
 */
async function getTagSuggestionPrompt(): Promise<string> {
    const config = await loadPromptConfig();
    const prompt = config.tagSuggestion;
    if (prompt) {
        logger.debug('[TagGenerator] Using tagSuggestion prompt from config');
        return prompt;
    }
    logger.warn('[TagGenerator] Using fallback tag suggestion prompt');
    return getFallbackTagSuggestionPrompt();
}

/**
 * Fallback tag suggestion prompt
 */
function getFallbackTagSuggestionPrompt(): string {
    return `Role: Banking AI Taxonomy Expert

Task: Suggest relevant tags from the banking AI taxonomy with strict domain alignment

## Taxonomy Categories

### Risk Categories (High Priority)
- credit-risk
- market-risk
- operational-risk
- liquidity-risk
- cyber-risk
- fraud-risk
- aml-risk
- model-risk

### AI Technologies
- machine-learning
- deep-learning
- neural-networks
- natural-language-processing
- computer-vision
- graph-neural-networks
- reinforcement-learning
- large-language-models
- transformers
- ensemble-methods
- time-series-analysis

### Business Areas
- credit-assessment
- fraud-detection
- compliance
- regulatory-reporting
- trading
- customer-analytics
- risk-modeling
- model-governance
- stress-testing
- capital-adequacy

### Application Types
- predictive-modeling
- anomaly-detection
- pattern-recognition
- automation
- decision-support
- monitoring
- classification
- regression
- clustering

### Regulatory Frameworks
- basel-iii
- basel-iv
- ifrs-9
- cecl
- ccar
- dfast
- gdpr
- aml-regulations

## Output Format
Return 3-5 most relevant tags as a JSON array:
[{"name": "tag1", "type": "Industrial"}, {"name": "tag2", "type": "Academic"}]

## Selection Criteria
1. MUST be specific to banking/finance domain
2. Cover both technology AND business aspects
3. Prioritize risk categories and regulatory tags when applicable
4. Avoid generic AI tags without banking context
5. Include regulatory framework tags when paper mentions compliance`;
}

/**
 * Generate tags using LLM based on paper content
 * With multi-provider fallback
 */
export async function generateTagsWithLLM(
    title: string,
    abstract: string,
    existingTags?: string[]
): Promise<TagGenerationResult> {
    if (!isLLMConfigured()) {
        return getFallbackTags(title, abstract);
    }

    const systemPrompt = await getTagSuggestionPrompt();

    const prompt = `Generate tags for this banking AI research paper:

TITLE: ${title}

ABSTRACT: ${abstract || 'No abstract available'}

${existingTags?.length ? `EXISTING TAGS (avoid duplicates): ${existingTags.join(', ')}` : ''}

Requirements:
1. Analyze the paper for banking AI domain alignment
2. Suggest 3-5 relevant tags covering technology and business aspects
3. Use the taxonomy defined in your role
4. Return ONLY a JSON array

Return format:
[
  {"name": "fraud-detection", "type": "Industrial", "category": "risk-management"},
  {"name": "deep-learning", "type": "Academic", "category": "ai-technology"}
]`;

    logger.info('[TagGenerator] Calling LLM for tag generation', { title: title.substring(0, 50) });

    try {
        const result = await generateJSONWithFallback<GeneratedTag[]>(prompt, systemPrompt);

        // Validate and normalize tags
        const validTags = result
            .filter(tag => tag.name && tag.type)
            .map(tag => ({
                name: tag.name.toLowerCase().replace(/\s+/g, '-'),
                type: tag.type,
                category: tag.category
            }));

        logger.info('[TagGenerator] Tags generated successfully', {
            title: title.substring(0, 50),
            tagCount: validTags.length,
            tags: validTags.map(t => t.name)
        });

        return {
            tags: validTags,
            confidence: 0.8,
            reasoning: `Generated ${validTags.length} tags using LLM based on content analysis`
        };

    } catch (error) {
        logger.warn('[TagGenerator] All LLM providers failed, using rule-based fallback', { title: title.substring(0, 50), error });
        return getFallbackTags(title, abstract);
    }
}

/**
 * Fallback tag generation using keyword matching
 */
function getFallbackTags(title: string, abstract: string): TagGenerationResult {
    const content = `${title} ${abstract}`.toLowerCase();
    const tags: GeneratedTag[] = [];
    
    // Industrial Categories
    if (content.includes("compliance") || content.includes("aml") || content.includes("laundering")) {
        tags.push({ name: "aml-compliance", type: "Industrial", category: "compliance" });
    }
    if (content.includes("risk") || content.includes("credit") || content.includes("default")) {
        tags.push({ name: "credit-risk", type: "Industrial", category: "risk-management" });
    }
    if (content.includes("fraud") || content.includes("detection")) {
        tags.push({ name: "fraud-detection", type: "Industrial", category: "risk-management" });
    }
    if (content.includes("kyc") || content.includes("cdd") || content.includes("due diligence")) {
        tags.push({ name: "ekyc-cdd", type: "Industrial", category: "compliance" });
    }
    if (content.includes("portfolio") || content.includes("trading") || content.includes("asset")) {
        tags.push({ name: "portfolio-optimization", type: "Industrial", category: "trading" });
    }
    
    // Academic Categories
    if (content.includes("agent") || content.includes("autonomous") || content.includes("multi-agent")) {
        tags.push({ name: "agent-designing", type: "Academic", category: "ai-technology" });
        tags.push({ name: "agentic-ai-pipeline", type: "Academic", category: "ai-technology" });
    }
    if (content.includes("llm") || content.includes("language model") || content.includes("gpt") || content.includes("bert")) {
        tags.push({ name: "llm-sft", type: "Academic", category: "ai-technology" });
    }
    if (content.includes("reinforcement") || content.includes("rl") || content.includes("q-network")) {
        tags.push({ name: "rlhf", type: "Academic", category: "ai-technology" });
    }
    if (content.includes("neural network") || content.includes("deep learning") || content.includes("machine learning")) {
        tags.push({ name: "deep-learning", type: "Academic", category: "ai-technology" });
    }
    
    // Deduplicate
    const uniqueTags = tags.filter((tag, index, self) =>
        index === self.findIndex((t) => t.name === tag.name)
    );
    
    logger.info('[TagGenerator] Fallback tags generated', { 
        tagCount: uniqueTags.length,
        tags: uniqueTags.map(t => t.name)
    });
    
    return {
        tags: uniqueTags.slice(0, 5),
        confidence: 0.6,
        reasoning: 'Fallback keyword-based tag generation'
    };
}

// Export config loader for external use
export { loadPromptConfig };
