/**
 * Content Filter - Uses LLM to check if content is relevant to banking/AI/risk
 * Returns relevance score and reasoning
 * Now reads prompt configuration from config/prompts.json
 */

import { generateJSONWithFallback, isLLMConfigured } from './llm-service';
import { logger } from './logger';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface ContentRelevanceResult {
    isRelevant: boolean;
    relevanceScore: number; // 1-10, calculated from dimensionScores (includes bonus if applicable)
    confidence: number; // 0-1
    reasoning: string;
    matchedCategories: string[];
    dimensionScores: {
        technical: number; // 1-10
        business: number; // 1-10
        timeliness: number; // 1-10
        practicality: number; // 1-10
    };
    technicalBonusApplied?: boolean; // Whether 1.05x bonus was applied
}

export interface ContentFilterOptions {
    minRelevanceScore?: number;
    requireBankingContext?: boolean;
    requireAITechnology?: boolean;
    focusAreas?: string[];
    excludeCategories?: string[];
    useConfigPrompt?: boolean;
}

const DEFAULT_FILTER_OPTIONS: ContentFilterOptions = {
    minRelevanceScore: 60,
    requireBankingContext: true,
    requireAITechnology: false,
    focusAreas: [
        'risk-management',
        'compliance',
        'fraud-detection',
        'customer-analytics',
        'trading',
        'credit-assessment',
        'regulatory-reporting',
        'process-automation'
    ],
    excludeCategories: ['cryptocurrency', 'blockchain-hype', 'non-financial'],
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
 * Get content assessment prompt from config or fallback
 */
async function getContentAssessmentPrompt(): Promise<string> {
    const config = await loadPromptConfig();
    return config.contentAssessment || getFallbackContentAssessmentPrompt();
}

/**
 * Fallback content assessment prompt
 */
function getFallbackContentAssessmentPrompt(): string {
    return `Role: Banking AI Content Evaluation Expert

Task: Evaluate paper relevance to banking AI research based on EXPLICIT content only

## Evaluation Dimensions (0-10 scale)

1. **Technical Relevance** (weight: 30%)
   - AI/ML technology sophistication and innovation
   - Methodology soundness and reproducibility

2. **Business Relevance** (weight: 40%)
   - Is banking/finance EXPLICITLY mentioned as application domain?
   - Does it address banking-specific problems?
   - Score based on EXPLICIT content only, NOT potential applications

3. **Timeliness** (weight: 10%)
   - Recency of research

4. **Practicality** (weight: 20%)
   - Experimental validation or real-world case studies
   - Reproducible methods with clear metrics

## Business Relevance Scoring (CRITICAL - Score STRICTLY)
- 9-10: Paper explicitly addresses banking/finance with clear use cases
- 7-8: Paper explicitly mentions finance/banking applications
- 5-6: Paper mentions financial keywords in financial context
- 3-4: Pure technology without EXPLICIT financial context
- 1-2: Completely outside domain (medical, gaming, physics primary application)

## IMPORTANT Rules
- Score Business based on EXPLICIT content only
- \"Stress testing\" in non-financial context = Business score 3-4
- Technical sophistication does NOT justify higher Business score

## Output Format (JSON)
{
  "isRelevant": true,
  "confidence": 0.8,
  "reasoning": "Brief explanation",
  "matchedCategories": ["category1"],
  "dimensionScores": {
    "technical": 8,
    "business": 4,
    "timeliness": 8,
    "practicality": 5
  }
}`;
}

// Banking and AI keywords for quick pre-filtering
const BANKING_KEYWORDS = [
    'bank', 'banking', 'financial', 'finance', 'fintech',
    'credit', 'loan', 'mortgage', 'investment', 'trading',
    'risk', 'compliance', 'regulatory', 'regulation',
    'payment', 'transaction', 'fraud', 'aml', 'kyc',
    'insurance', 'wealth', 'asset', 'portfolio'
];

const AI_KEYWORDS = [
    'artificial intelligence', 'machine learning', 'deep learning',
    'neural network', 'nlp', 'natural language processing',
    'computer vision', 'predictive', 'algorithm', 'model',
    'automation', 'robotic', 'chatbot', 'generative ai',
    'llm', 'large language model', 'data science', 'analytics'
];

/**
 * Check if content is relevant to banking AI research
 * With multi-provider fallback
 */
export async function checkContentRelevance(
    title: string,
    abstract: string,
    options: ContentFilterOptions = {}
): Promise<ContentRelevanceResult> {
    const opts = { ...DEFAULT_FILTER_OPTIONS, ...options };
    const content = `${title} ${abstract}`.toLowerCase();

    // Quick pre-filtering for obvious non-relevant content
    const quickCheck = performQuickCheck(content, opts);
    if (quickCheck.shouldSkip) {
        logger.debug('Content filtered by quick check', { title: title.substring(0, 50) });
        return quickCheck.result;
    }

    // Check if LLM is configured
    if (!isLLMConfigured()) {
        return getFallbackRelevanceResult(title, abstract, opts);
    }

    // Get system prompt
    const systemPrompt = opts.useConfigPrompt !== false
        ? await getContentAssessmentPrompt()
        : getFallbackContentAssessmentPrompt();

    const prompt = `Evaluate the following paper:

TITLE: ${title}

ABSTRACT: ${abstract || 'No abstract available'}`;

    try {
        const result = await generateJSONWithFallback<ContentRelevanceResult>(prompt, systemPrompt);
        
        // Ensure confidence is within bounds
        result.confidence = Math.max(0, Math.min(1, result.confidence));
        
        // Calculate weighted total relevance score from dimensionScores (1-10 scale)
        const dims = result.dimensionScores;
        let weightedTotal = (
            dims.technical * 0.30 +
            dims.business * 0.40 +
            dims.timeliness * 0.10 +
            dims.practicality * 0.20
        );
        
        // Technical Excellence Bonus: if business <= 4 but technical >= 8,
        // apply 1.05x multiplier for technical innovation value
        const technicalBonusApplied = dims.business <= 4 && dims.technical >= 8;
        if (technicalBonusApplied) {
            weightedTotal = weightedTotal * 1.05;
        }
        
        result.relevanceScore = weightedTotal;
        result.technicalBonusApplied = technicalBonusApplied;
        
        // Override isRelevant based on threshold (>= 5)
        result.isRelevant = weightedTotal >= 5;
        
        logger.debug('Content relevance check complete', { 
            title: title.substring(0, 50),
            score: result.relevanceScore,
            isRelevant: result.isRelevant,
            technicalBonusApplied
        });

        console.log('[CONTENT-ASSESSMENT]', JSON.stringify({
            title: title.substring(0, 80),
            technical: dims.technical,
            business: dims.business,
            timeliness: dims.timeliness,
            practicality: dims.practicality,
            rawTotal: (
                dims.technical * 0.30 +
                dims.business * 0.40 +
                dims.timeliness * 0.10 +
                dims.practicality * 0.20
            ).toFixed(2),
            total: weightedTotal.toFixed(2),
            technicalBonus: technicalBonusApplied ? 1.05 : 1,
            isRelevant: result.isRelevant,
            reasoning: result.reasoning?.substring(0, 100)
        }));

        return result;

    } catch (error) {
        logger.warn('All LLM providers failed for content relevance check, using rule-based fallback', { title: title.substring(0, 50), error });
        return getFallbackRelevanceResult(title, abstract, opts);
    }
}

/**
 * Batch check multiple content items for relevance
 */
export async function checkBatchRelevance(
    items: Array<{ title: string; abstract: string; url: string }>,
    options: ContentFilterOptions = {}
): Promise<Array<{ url: string; result: ContentRelevanceResult }>> {
    const results: Array<{ url: string; result: ContentRelevanceResult }> = [];
    
    // Process in batches to avoid overwhelming the LLM
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (item) => {
            const result = await checkContentRelevance(item.title, item.abstract, options);
            return { url: item.url, result };
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }
    
    return results;
}

/**
 * Check if content is a duplicate or near-duplicate
 */
export async function checkSimilarity(
    newTitle: string,
    newAbstract: string,
    existingTitles: string[]
): Promise<{ isDuplicate: boolean; similarityScore: number; matchedTitle?: string }> {
    const normalizedNew = normalizeText(`${newTitle} ${newAbstract}`);
    
    for (const existing of existingTitles) {
        const similarity = calculateSimilarity(normalizedNew, normalizeText(existing));
        if (similarity > 0.85) {
            return { isDuplicate: true, similarityScore: similarity, matchedTitle: existing };
        }
    }
    
    return { isDuplicate: false, similarityScore: 0 };
}

// Helper functions
function performQuickCheck(
    content: string,
    options: ContentFilterOptions
): { shouldSkip: boolean; result: ContentRelevanceResult } {
    // Check for excluded categories
    if (options.excludeCategories) {
        for (const category of options.excludeCategories) {
            if (content.includes(category.toLowerCase())) {
                return {
                        shouldSkip: true,
                        result: {
                            isRelevant: false,
                            relevanceScore: 1,
                            confidence: 0.9,
                            reasoning: `Content matches excluded category: ${category}`,
                            matchedCategories: [],
                            dimensionScores: {
                                technical: 1,
                                business: 1,
                                timeliness: 1,
                                practicality: 1
                            }
                        }
                    };
            }
        }
    }
    
    // Check banking context requirement
    if (options.requireBankingContext) {
        const hasBankingKeyword = BANKING_KEYWORDS.some(kw => content.includes(kw));
        if (!hasBankingKeyword) {
            // Not necessarily a skip, but low relevance
            return {
                shouldSkip: false,
                result: {
                    isRelevant: false,
                    relevanceScore: 2,
                    confidence: 0.7,
                    reasoning: 'No banking keywords detected',
                    matchedCategories: [],
                    dimensionScores: {
                        technical: 3,
                        business: 2,
                        timeliness: 2,
                        practicality: 2
                    }
                }
            };
        }
    }
    
    return { shouldSkip: false, result: {} as ContentRelevanceResult };
}

function getFallbackRelevanceResult(
    title: string,
    abstract: string,
    options: ContentFilterOptions
): ContentRelevanceResult {
    const content = `${title} ${abstract}`.toLowerCase();
    
    let score = 50; // Base score
    const matchedCategories: string[] = [];
    
    // Check banking keywords
    const bankingMatches = BANKING_KEYWORDS.filter(kw => content.includes(kw));
    if (bankingMatches.length > 0) {
        score += 20;
        matchedCategories.push('banking');
    }
    
    // Check AI keywords
    const aiMatches = AI_KEYWORDS.filter(kw => content.includes(kw));
    if (aiMatches.length > 0) {
        score += 20;
        matchedCategories.push('ai-technology');
    }
    
    // Bonus for both banking and AI
    if (bankingMatches.length > 0 && aiMatches.length > 0) {
        score += 10;
    }
    
    // Check focus areas
    if (options.focusAreas) {
        for (const area of options.focusAreas) {
            if (content.includes(area.toLowerCase().replace('-', ' '))) {
                score += 5;
                matchedCategories.push(area);
            }
        }
    }
    
    score = Math.min(100, score);
    
    // Calculate dimension scores for fallback
    const technicalScore = aiMatches.length > 0 ? Math.min(10, 5 + aiMatches.length) : 3;
    const businessScore = bankingMatches.length > 0 ? Math.min(10, 5 + bankingMatches.length) : 3;
    
    // Calculate weighted total (1-10 scale)
    const timelinessScore = 5; // Neutral for fallback
    const practicalityScore = bankingMatches.length > 0 && aiMatches.length > 0 ? 6 : 4;
    const weightedTotal = (
        technicalScore * 0.30 +
        businessScore * 0.40 +
        timelinessScore * 0.10 +
        practicalityScore * 0.20
    );
    
    return {
        isRelevant: weightedTotal >= 5, // Threshold: 5
        relevanceScore: weightedTotal,
        confidence: 0.6,
        reasoning: 'Fallback heuristic scoring based on keyword matching',
        matchedCategories: [...new Set(matchedCategories)],
        dimensionScores: {
            technical: technicalScore,
            business: businessScore,
            timeliness: timelinessScore,
            practicality: practicalityScore
        }
    };
}

function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(' '));
    const words2 = new Set(text2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
}

// Export utility functions
export function extractKeywords(text: string): string[] {
    const content = text.toLowerCase();
    const keywords = [...BANKING_KEYWORDS, ...AI_KEYWORDS];
    return keywords.filter(kw => content.includes(kw));
}

export function categorizeContent(
    title: string,
    abstract: string
): string[] {
    const content = `${title} ${abstract}`.toLowerCase();
    const categories: string[] = [];
    
    const categoryKeywords: Record<string, string[]> = {
        'risk-management': ['risk', 'credit risk', 'market risk', 'operational risk', 'stress test'],
        'compliance': ['compliance', 'regulatory', 'regulation', 'basel', 'gdpr', 'aml', 'kyc'],
        'fraud-detection': ['fraud', 'anomaly', 'detection', 'anti-money laundering'],
        'trading': ['trading', 'algorithmic', 'high-frequency', 'market making'],
        'customer-analytics': ['customer', 'personalization', 'recommendation', 'churn'],
        'credit-assessment': ['credit', 'loan', 'underwriting', 'default', 'credit scoring']
    };
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(kw => content.includes(kw))) {
            categories.push(category);
        }
    }
    
    return categories;
}

// Export config loader for external use
export { loadPromptConfig };
