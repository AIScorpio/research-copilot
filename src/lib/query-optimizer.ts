/**
 * Query Optimizer - LLM-powered query optimization for research collection
 * SIMPLIFIED VERSION: Unified relaxed format for all data sources
 */

import { join } from 'path';
import { promises as fs } from 'fs';
import { logger } from './logger';
import { generateTextWithFallback, isLLMConfigured } from './llm-service';

export interface OptimizedQuery {
    originalQuery: string;
    optimizedQuery: string;
    source: 'llm' | 'fallback';
}

export interface QueryOptimizationOptions {
    focusAreas?: string[];
    useConfigPrompt?: boolean;
    strictness?: 'relaxed' | 'balanced' | 'strict';
    mode?: 'auto' | 'pipeline';
}

const DEFAULT_OPTIONS: QueryOptimizationOptions = {
    focusAreas: ['risk-management', 'compliance', 'fraud-detection', 'credit-assessment', 'market-risk'],
    useConfigPrompt: true,
    mode: 'auto',
    strictness: 'balanced'
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
 * Replaces template variables with actual values
 */
async function getQueryOptimizationPrompt(options: QueryOptimizationOptions): Promise<string> {
    const config = await loadPromptConfig();
    let prompt = config['queryOptimization'] || getFallbackQueryOptimizationPrompt();
    
    // Replace template variables
    const mode = options.mode || 'auto';
    const strictness = options.strictness || 'balanced';
    
    prompt = prompt.replace(/\{\{MODE\}\}/g, mode);
    prompt = prompt.replace(/\{\{STRICTNESS\}\}/g, strictness);
    
    // Replace placeholder sections with actual rules (these can be expanded later)
    prompt = prompt.replace(/\{\{TECH_RULES\}\}/g, getTechRules());
    prompt = prompt.replace(/\{\{DOMAIN_RULES\}\}/g, getDomainRules());
    prompt = prompt.replace(/\{\{EXCLUSION_RULES\}\}/g, getExclusionRules());
    
    return prompt;
}

/**
 * Get tech expansion rules for prompt
 */
function getTechRules(): string {
    return `Expand the input with synonyms and variants:
- "GNN" → "graph neural network" OR "GNN" OR "graph convolution" OR "graph attention"
- "LLM" → "large language model" OR "LLM" OR "transformer" OR "GPT" OR "BERT"
- "time series" → "time series" OR "forecasting" OR "sequential modeling"
- "reinforcement learning" → "reinforcement learning" OR "RL" OR "policy optimization"
- "neural network" → "neural network" OR "deep learning" OR "deep neural network"`;
}

/**
 * Get domain selection rules for prompt
 */
function getDomainRules(): string {
    return `Select 2-4 banking applications RELEVANT to the tech:
- GNN → "AML" OR "fraud detection" OR "transaction network" OR "customer relationship"
- LLM → "compliance" OR "regulatory reporting" OR "risk assessment" OR "document analysis"
- Time series → "market risk" OR "trading" OR "liquidity risk" OR "volatility"
- RL → "portfolio optimization" OR "trading strategy" OR "risk management"
- Generic/unknown → "credit risk" OR "fraud detection" OR "compliance" OR "risk assessment"`;
}

/**
 * Get exclusion rules for prompt
 */
function getExclusionRules(): string {
    return `Select domains that ALSO use this tech (NOT banking):
- GNN → "molecular" OR "drug discovery" OR "social network analysis" OR "recommendation systems"
- LLM → "creative writing" OR "gaming" OR "translation" OR "chatbot" OR "entertainment"
- Time series → "weather" OR "climate" OR "signal processing" OR "IoT"
- RL → "game playing" OR "robotics" OR "autonomous vehicles"
- Generic → "medical" OR "quantum" OR "astrophysics" OR "physics"`;
}

/**
 * Fallback prompt for query optimization
 */
function getFallbackQueryOptimizationPrompt(): string {
    return `Role: Banking AI Query Optimization Expert

Task: Transform user input into a Boolean query for ArXiv/Semantic Scholar

## Query Structure (ALWAYS use this)
(Tech Terms) AND (Domain Terms) AND ("banking" OR "financial") NOT (Exclusions)

## Rules

1. **Tech Terms**: Expand the input with synonyms and variants
   - "GNN" → "graph neural network" OR "GNN" OR "graph convolution"
   - "LLM" → "large language model" OR "LLM" OR "transformer" OR "GPT"

2. **Domain Terms**: Select 2-4 banking applications RELEVANT to the tech
   - GNN → "AML" OR "fraud detection" OR "transaction network"
   - LLM → "compliance" OR "regulatory" OR "risk assessment"
   - Generic → "credit risk" OR "fraud detection" OR "compliance"

3. **Exclusions**: Select domains that ALSO use this tech (NOT banking)
   - GNN → "molecular" OR "drug" OR "social network"
   - LLM → "creative writing" OR "gaming" OR "translation"
   - Generic → "medical" OR "quantum" OR "astrophysics"

4. **Industry**: Always use "banking" OR "financial"

## Output
Return ONLY the Boolean query string. No explanations. No JSON.`;
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
        logger.info('[QUERY-OPT] LLM not configured, using fallback', { query });
        return getFallbackOptimization(query, opts);
    }

    // Get system prompt with template variables replaced
    const systemPrompt = opts.useConfigPrompt !== false
        ? await getQueryOptimizationPrompt(opts)
        : getFallbackQueryOptimizationPrompt();

    const prompt = `Optimize the following query:

Original Query: "${query}"

Strictness Level: ${(opts.strictness || 'relaxed').toUpperCase()}`;

    try {
        const optimizedQuery = await generateTextWithFallback(prompt, systemPrompt);
        
        const trimmedQuery = optimizedQuery.trim();
        
        logger.info('[QUERY-OPT] Source: llm', {
            original: query,
            optimized: trimmedQuery.substring(0, 100) + (trimmedQuery.length > 100 ? '...' : '')
        });

        return {
            originalQuery: query,
            optimizedQuery: trimmedQuery,
            source: 'llm' as const
        };

    } catch (error) {
        logger.warn('[QUERY-OPT] LLM failed, using fallback', { 
            query, 
            error: (error as Error).message 
        });
        return getFallbackOptimization(query, opts);
    }
}

/**
 * Fallback optimization - Respects mode and strictness settings
 */
function getFallbackOptimization(
    query: string,
    options: QueryOptimizationOptions
): OptimizedQuery {
    const mode = options.mode || 'auto';
    const strictness = options.strictness || 'balanced';
    
    const queryTerms = query.split(/\s+/).filter(t => t.length > 2 && t !== 'AND' && t !== 'OR');
    const expandedQuery = queryTerms.length > 1
        ? queryTerms.join(' OR ')
        : query;

    let optimizedQuery: string;
    
    // Determine if banking context should be added
    const shouldAddBanking = () => {
        if (mode === 'auto') return true;
        if (mode === 'pipeline' && strictness === 'strict') return true;
        if (mode === 'pipeline' && strictness === 'balanced') {
            // Check if query is generic or banking-related
            const bankingKeywords = ['fraud', 'credit', 'risk', 'compliance', 'aml', 'banking', 'finance', 'trading', 'portfolio'];
            const queryLower = query.toLowerCase();
            return bankingKeywords.some(kw => queryLower.includes(kw));
        }
        return false; // relaxed mode or generic balanced
    };

    if (shouldAddBanking()) {
        optimizedQuery = `(${expandedQuery} OR machine learning OR deep learning) AND (banking OR finance OR credit OR risk) NOT (astrophysics OR quantum OR medical)`;
    } else {
        optimizedQuery = `(${expandedQuery} OR machine learning OR deep learning) NOT (astrophysics OR quantum OR medical)`;
    }

    logger.info('[QUERY-OPT] Source: fallback', {
        original: query,
        mode,
        strictness,
        optimized: optimizedQuery.substring(0, 100) + (optimizedQuery.length > 100 ? '...' : '')
    });

    return {
        originalQuery: query,
        optimizedQuery,
        source: 'fallback' as const
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
