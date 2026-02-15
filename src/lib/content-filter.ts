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
    relevanceScore: number; // 1-10, calculated from dimensionScores
    confidence: number; // 0-1
    reasoning: string;
    matchedCategories: string[];
    suggestedTags: string[];
    dimensionScores: {
        technical: number; // 1-10
        business: number; // 1-10
        timeliness: number; // 1-10
        practicality: number; // 1-10
    };
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
    return `Role: Banking AI Research Content Evaluation Expert

Task: Evaluate paper/news content relevance to banking AI research with strict precision criteria

## Evaluation Dimensions (0-10 scale each)

1. **Technical Relevance** (weight: 30%)
   - Does it involve AI/ML/DL technologies applicable to banking?
   - How advanced and innovative is the technology for financial use cases?
   - Is the methodology sound and reproducible?

2. **Business Relevance** (weight: 40%)
   - Is it targeting specific banking business scenarios?
   - Does it cover risk/compliance/credit/anti-fraud core areas?
   - Does it have practical application value in financial institutions?
   - Does it address regulatory requirements (Basel, IFRS 9, AML)?

3. **Timeliness** (weight: 10%)
   - Is it recent research (last 3 years for foundational, last 1 year for cutting-edge)?
   - Does it involve latest technology trends applicable to banking?

4. **Practicality** (weight: 20%)
   - Does it have experimental validation or real-world case studies?
   - Does it provide reproducible methods with clear metrics?
   - Are there implementation considerations for banking environments?

## Scoring Criteria
- 9-10: Highly relevant, strongly recommended (clear banking + AI + practical application + regulatory alignment)
- 7-8: Relevant, worth including (finance + AI with clear use case, or banking + advanced analytics)
- 5-6: Partially relevant, optional (AI technology with transferable banking application but not explicitly demonstrated)
- 3-4: Weak relevance (pure technology without banking context, or pure banking business without AI)
- 1-2: Not relevant (completely outside domain)

## Strict Exclusion Criteria (Auto-Reject)
- Pure physics/astrophysics applications
- Pure theoretical CS without financial application
- Cryptocurrency speculation without regulatory/risk focus
- Medical/healthcare applications
- Gaming/entertainment focused

## Output Format (JSON)
{
  "total_score": 7.5,
  "dimension_scores": {
    "technical": 8,
    "business": 8,
    "timeliness": 7,
    "practicality": 7
  },
  "reasoning": "Brief explanation of scoring rationale focusing on banking applicability",
  "recommendation": "accept" | "reject",
  "tags": ["suggested tag 1", "suggested tag 2"],
  "banking_use_cases": ["specific banking application scenario 1", "scenario 2"]
}

## Acceptance Threshold
total_score >= 6.0 AND business >= 6.0 AND technical >= 5.0

Rejection overrides: If business < 4.0 OR contains exclusion criteria topics`;
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

    const prompt = `Evaluate the relevance of this content for banking AI research:

TITLE: ${title}

ABSTRACT: ${abstract || 'No abstract available'}

Evaluation Requirements:
1. Assess relevance to banking/financial services (business value)
2. Assess technical sophistication and AI/ML methodology
3. Assess timeliness and current relevance
4. Assess practical applicability in banking
5. Identify specific application areas (risk, compliance, trading, etc.)
6. Suggest relevant tags (3-5 tags)
7. Check against exclusion criteria (physics, pure CS, crypto speculation, medical, gaming)

IMPORTANT: Return dimension scores as 1-10 (not 0-100). Use the following scale:
- 1-3: Low relevance/poor quality
- 4-6: Moderate relevance/average quality  
- 7-8: High relevance/good quality
- 9-10: Excellent relevance/outstanding quality

Return a JSON object with this structure:
{
    "isRelevant": true/false,
    "confidence": 0.0-1.0,
    "reasoning": "Brief explanation of the scoring rationale",
    "matchedCategories": ["category1", "category2"],
    "suggestedTags": ["tag1", "tag2", "tag3"],
    "dimensionScores": {
        "technical": 1-10,
        "business": 1-10,
        "timeliness": 1-10,
        "practicality": 1-10
    }
}

Note: Total relevance score will be calculated as weighted average:
- Technical (30%) + Business (40%) + Timeliness (10%) + Practicality (20%)
- Papers with total score < 5 will be filtered out`;

    try {
        const result = await generateJSONWithFallback<ContentRelevanceResult>(prompt, systemPrompt);
        
        // Ensure confidence is within bounds
        result.confidence = Math.max(0, Math.min(1, result.confidence));
        
        // Calculate weighted total relevance score from dimensionScores (1-10 scale)
        const dims = result.dimensionScores;
        const weightedTotal = (
            dims.technical * 0.30 +
            dims.business * 0.40 +
            dims.timeliness * 0.10 +
            dims.practicality * 0.20
        );
        result.relevanceScore = weightedTotal;
        
        // Override isRelevant based on threshold (>= 5)
        result.isRelevant = weightedTotal >= 5;
        
        logger.debug('Content relevance check complete', { 
            title: title.substring(0, 50),
            score: result.relevanceScore,
            isRelevant: result.isRelevant
        });

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
                        suggestedTags: [],
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
                    suggestedTags: ['general-ai'],
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
    const suggestedTags: string[] = [];
    
    // Check banking keywords
    const bankingMatches = BANKING_KEYWORDS.filter(kw => content.includes(kw));
    if (bankingMatches.length > 0) {
        score += 20;
        matchedCategories.push('banking');
        suggestedTags.push(...bankingMatches.slice(0, 2));
    }
    
    // Check AI keywords
    const aiMatches = AI_KEYWORDS.filter(kw => content.includes(kw));
    if (aiMatches.length > 0) {
        score += 20;
        matchedCategories.push('ai-technology');
        suggestedTags.push(...aiMatches.slice(0, 2));
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
        suggestedTags: [...new Set(suggestedTags)].slice(0, 5),
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
