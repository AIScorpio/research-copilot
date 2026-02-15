/**
 * Query Optimizer - LLM-powered query optimization for research collection
 * SIMPLIFIED VERSION: Unified relaxed format for all data sources
 */

import { join } from 'path';
import { promises as fs } from 'fs';
import { logger } from './logger';
import { generateJSONWithFallback, isLLMConfigured } from './llm-service';

export interface OptimizedQuery {
    originalQuery: string;
    optimizedQuery: string;
    bankingSpecificTerms: string[];
    rationale: string;
}

export interface QueryOptimizationOptions {
    focusAreas?: string[];
    useConfigPrompt?: boolean;
    strictness?: 'relaxed' | 'balanced' | 'strict';
}

const DEFAULT_OPTIONS: QueryOptimizationOptions = {
    focusAreas: ['risk-management', 'compliance', 'fraud-detection', 'credit-assessment', 'market-risk'],
    useConfigPrompt: true
};

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
        logger.debug('Loaded prompt config from config/prompts.json');
        return cachedPromptConfig || {};
    } catch (error) {
        logger.warn('Failed to load config/prompts.json, using fallback prompts', { error });
        return {};
    }
}

/**
 * Get query optimization prompt from config or fallback
 */
async function getQueryOptimizationPrompt(): Promise<string> {
    const config = await loadPromptConfig();
    return config['queryOptimization'] || getFallbackQueryOptimizationPrompt();
}

/**
 * Fallback prompt for query optimization
 */
function getFallbackQueryOptimizationPrompt(): string {
    return `Role: Banking AI Research Search Optimization Expert

Task: Optimize user search queries for academic databases with RELAXED format for maximum recall

## Query Structure (RELAXED - Maximum Recall):
- Use OR between related terms for broad coverage
- Structure: (term1 OR term2 OR term3) AND (banking OR finance OR risk) NOT (exclusions)
- NO 'all:' prefix, NO 'cat:' categories, NO field-specific syntax
- Keep it simple and generic for all academic databases

## Banking-Specific Terminology
- Risk: credit risk, fraud detection, AML, Basel, IFRS 9, stress testing
- Tech: machine learning, deep learning, neural networks, NLP
- Business: compliance, regulatory, trading, portfolio optimization

## Examples
- Input: "credit risk"
- Output: (credit risk OR default prediction OR PD modeling) AND (banking OR finance) NOT (medical OR astrophysics)

Return ONLY the optimized Boolean query string.`;
}

/**
 * Optimize a generic query into banking-specific search terms
 * UNIFIED: Uses RELAXED format for all data sources
 */
export async function optimizeQuery(
    query: string,
    options: QueryOptimizationOptions = {}
): Promise<OptimizedQuery> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Check if LLM is configured
    if (!isLLMConfigured()) {
        logger.debug('LLM not configured, using fallback', { query });
        return getFallbackOptimization(query, opts);
    }

    // Get system prompt
    const systemPrompt = opts.useConfigPrompt !== false
        ? await getQueryOptimizationPrompt()
        : getFallbackQueryOptimizationPrompt();

    const prompt = `Optimize the following query for banking/AI research collection:

Original Query: "${query}"

Strictness Level: ${(opts.strictness || 'relaxed').toUpperCase()}

Generate a RELAXED Boolean query:
- Use OR between related terms
- AND with banking/finance terms
- NOT to exclude irrelevant domains
- NO database-specific syntax (no 'all:', no 'cat:')

Return a JSON object:
{
    "optimizedQuery": "The Boolean query string",
    "bankingSpecificTerms": ["term1", "term2", "term3", "term4", "term5"],
    "rationale": "Brief explanation"
}`;

    try {
        const response = await generateJSONWithFallback<{
            optimizedQuery: string;
            bankingSpecificTerms: string[];
            rationale: string;
        }>(prompt, systemPrompt);

        logger.debug('Query optimization complete', {
            original: query,
            optimized: response.optimizedQuery
        });

        return {
            originalQuery: query,
            optimizedQuery: response.optimizedQuery,
            bankingSpecificTerms: response.bankingSpecificTerms,
            rationale: response.rationale
        };

    } catch (error) {
        logger.warn('LLM query optimization failed, using fallback', { query, error });
        return getFallbackOptimization(query, opts);
    }
}

/**
 * Fallback optimization - RELAXED format (same as auto-collect)
 */
function getFallbackOptimization(
    query: string,
    _options: QueryOptimizationOptions
): OptimizedQuery {
    const bankingTerms = [
        'credit risk',
        'fraud detection',
        'AML',
        'compliance',
        'Basel',
        'IFRS 9',
        'stress testing'
    ];

    // RELAXED: Split query and use OR
    const queryTerms = query.split(/\s+/).filter(t => t.length > 2 && t !== 'AND' && t !== 'OR');
    const expandedQuery = queryTerms.length > 1
        ? queryTerms.join(' OR ')
        : query;

    // RELAXED: Simple generic format for ALL data sources
    const optimizedQuery = `(${expandedQuery} OR machine learning OR deep learning) AND (banking OR finance OR credit OR risk) NOT (astrophysics OR quantum OR medical)`;

    return {
        originalQuery: query,
        optimizedQuery,
        bankingSpecificTerms: bankingTerms,
        rationale: 'RELAXED fallback: OR-based terms for maximum recall across all sources'
    };
}

/**
 * Generate query variations for comprehensive collection
 */
export async function generateQueryVariations(
    baseQuery: string,
    count: number = 3
): Promise<string[]> {
    const variations: string[] = [baseQuery];

    const prefixes = [
        'machine learning',
        'deep learning',
        'neural networks',
        'predictive analytics',
        'AI'
    ];

    const suffixes = [
        'banking',
        'credit risk',
        'fraud detection',
        'compliance',
        'AML'
    ];

    for (let i = 0; i < count - 1 && i < prefixes.length; i++) {
        variations.push(`${prefixes[i]} ${baseQuery} ${suffixes[i % suffixes.length]}`);
    }

    return variations.slice(0, count);
}

/**
 * Expand a topic into sub-topics for targeted collection
 */
export async function expandTopic(
    topic: string
): Promise<{ mainTopic: string; subTopics: string[]; relatedConcepts: string[] }> {
    return {
        mainTopic: topic,
        subTopics: [
            `${topic} in credit risk assessment`,
            `${topic} for fraud detection`,
            `${topic} in AML compliance`,
            `${topic} for regulatory reporting`,
            `${topic} in market risk modeling`
        ],
        relatedConcepts: [
            'machine learning',
            'deep learning',
            'Basel III',
            'IFRS 9',
            'stress testing',
            'model risk management'
        ]
    };
}

// Export utility functions
export function combineQueries(queries: string[]): string {
    const unique = [...new Set(queries.map(q => q.trim()))];
    return unique.join(' OR ');
}

export function sanitizeQuery(query: string): string {
    return query
        .replace(/[\x00-\x1F\x7F]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 500);
}

// Export config loader for external use
export { loadPromptConfig };
