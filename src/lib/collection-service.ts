/**
 * Enhanced Collection Service - Orchestrates the full collection flow
 * Features:
 * - LLM-powered query optimization
 * - Multi-source collection
 * - Database duplicate detection
 * - LLM-powered content filtering
 * - Configurable limits and modes
 * - Manual mode inherits auto mode base conditions
 */

import { searchOnline, SearchResult } from './collector';
import { optimizeQuery, OptimizedQuery, QueryOptimizationOptions } from './query-optimizer';
import { checkContentRelevance, ContentFilterOptions, ContentRelevanceResult } from './content-filter';
import { processPaper } from './processor';
import { prisma } from './db';
import { logger } from './logger';
import { revalidatePath } from 'next/cache';
import { triggerCollectionAlerts } from './newsletter';

export type CollectionMode = 'auto' | 'manual' | 'pipeline';

export interface CollectionOptions {
    mode: CollectionMode;
    query?: string;
    horizon?: 'today' | 'week' | 'month' | 'year' | 'custom';
    dateFrom?: string; // ISO date format: "2025-11-13"
    dateTo?: string; // ISO date format: "2026-02-13"
    useLLMOptimization?: boolean;
    useLLMFiltering?: boolean;
    queryStrictness?: 'relaxed' | 'balanced' | 'strict';
    maxResults?: number; // Soft limit - will collect up to this many papers
    minRelevanceScore?: number;
    sources?: string[]; // Specific source names to use
    focusAreas?: string[];
    skipDuplicates?: boolean;
}

export interface CollectionResult {
    success: boolean;
    message: string;
    totalFound: number;
    newCount: number;
    duplicateCount: number;
    filteredCount: number;
    // Detailed breakdown for pipeline logs
    stats?: {
        rawFound: number;
        afterSearchLimit: number;
        afterDuplicateFilter: number;
        afterLLMFilter: number;
        finalSaved: number;
    };
    errors: string[];
    query: string;
    optimizedQuery?: string;
    papers: Array<{
        id: string;
        title: string;
        url: string;
        relevanceScore: number;
    }>;
    duration: number; // milliseconds
}

// Base configuration that all modes inherit from
const BASE_CONFIG: Partial<CollectionOptions> = {
    query: 'AI in banking',
    useLLMOptimization: true,
    useLLMFiltering: true,
    skipDuplicates: true,
    minRelevanceScore: 60
};

// Mode-specific configurations (inherit from BASE_CONFIG)
const MODE_DEFAULTS: Record<CollectionMode, Partial<CollectionOptions>> = {
    auto: {
        ...BASE_CONFIG,
        horizon: 'month',
        maxResults: 100, // Soft limit: 100 papers
        minRelevanceScore: 5, // 1-10 scale: 5 is minimum for "partially relevant"
        focusAreas: ['risk-management', 'compliance', 'fraud-detection', 'credit-assessment']
    },
    manual: {
        ...BASE_CONFIG,
        horizon: 'month',
        maxResults: 100, // Soft limit: 100 papers
        minRelevanceScore: 5, // 1-10 scale
        focusAreas: ['risk-management', 'compliance', 'fraud-detection', 'credit-assessment', 'market-risk', 'trading']
    },
    pipeline: {
        ...BASE_CONFIG,
        horizon: 'year',
        maxResults: 200,
        minRelevanceScore: 5, // 1-10 scale
        focusAreas: ['risk-management', 'compliance', 'fraud-detection', 'credit-assessment', 'model-governance']
    }
};

/**
 * Main collection orchestration function
 * Manual mode inherits base conditions from auto mode
 */
export async function runCollection(options: CollectionOptions): Promise<CollectionResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    // Note: LLM providers are now initialized globally via initializeLLMSystem()
    // in the app entry point. No need to initialize here.

    // Merge options: BASE_CONFIG -> MODE_DEFAULTS -> user options
    // This ensures manual mode inherits auto mode base conditions
    const opts = {
        ...BASE_CONFIG,
        ...MODE_DEFAULTS[options.mode],
        ...options
    };
    
    logger.info(`Collection started`, {
        mode: opts.mode,
        query: opts.query,
        useLLM: opts.useLLMOptimization,
        maxResults: opts.maxResults,
        horizon: opts.horizon,
        dateFrom: opts.dateFrom,
        dateTo: opts.dateTo,
        queryStrictness: opts.queryStrictness
    });

    try {
        // Step 1: Calculate date range
        const { sinceDate, toDate } = calculateDateRange(opts);
        
        // Step 2: Get enabled sources
        const sources = await getEnabledSources(opts.sources);
        
        // Step 3: Optimize query (UNIFIED relaxed format for all sources)
        let searchQuery = opts.query || 'AI in banking';
        let optimizedQuery: OptimizedQuery | null = null;
        
        if (opts.useLLMOptimization) {
            try {
                const optimizationOptions: QueryOptimizationOptions = {
                    focusAreas: opts.focusAreas,
                    useConfigPrompt: true,
                    strictness: opts.queryStrictness || 'balanced'
                };
                
                optimizedQuery = await optimizeQuery(searchQuery, optimizationOptions);
                searchQuery = optimizedQuery.optimizedQuery;
                
                logger.debug('Query optimized', { 
                    original: optimizedQuery.originalQuery,
                    optimized: optimizedQuery.optimizedQuery,
                    rationale: optimizedQuery.rationale
                });
            } catch (error) {
                errors.push(`Query optimization failed: ${(error as Error).message}`);
                logger.error('Query optimization error', { error });
            }
        }

        // Step 4: Search multiple sources with unified query
        logger.debug('Searching sources', {
            query: searchQuery,
            sources: sources.length,
            since: sinceDate?.toISOString(),
            to: toDate?.toISOString()
        });

        const rawResults = await searchOnline(searchQuery, sinceDate, toDate, sources);
        
        // Apply soft max results limit (get more for filtering, but respect limit)
        const searchLimit = opts.maxResults ? opts.maxResults * 3 : undefined; // Get 3x for filtering
        const limitedResults = searchLimit 
            ? rawResults.slice(0, searchLimit)
            : rawResults;
        
        logger.debug(`Found ${rawResults.length} raw results, processing ${limitedResults.length}`);

        // Step 5: Check database for duplicates
        const { newResults, duplicates } = opts.skipDuplicates !== false
            ? await filterDuplicates(limitedResults)
            : { newResults: limitedResults, duplicates: [] };
        
        logger.debug(`After duplicate check: ${newResults.length} new, ${duplicates.length} duplicates`);

        // Step 6: Filter content with LLM
        let filteredResults: Array<{ result: SearchResult; relevance: ContentRelevanceResult }> = [];
        
        if (opts.useLLMFiltering) {
            const filterOptions: ContentFilterOptions = {
                minRelevanceScore: opts.minRelevanceScore || 60,
                requireBankingContext: true,
                requireAITechnology: opts.mode === 'pipeline',
                focusAreas: opts.focusAreas
            };
            
            filteredResults = await filterContentWithLLM(newResults, filterOptions);
            logger.debug(`After LLM filtering: ${filteredResults.length} relevant`);
        } else {
            // No LLM filtering, use all new results
            filteredResults = newResults.map(r => ({
                result: r,
                relevance: {
                    isRelevant: true,
                    relevanceScore: 7.5,
                    confidence: 0.5,
                    reasoning: 'LLM filtering disabled',
                    matchedCategories: [],
                    suggestedTags: [],
                    dimensionScores: {
                        technical: 7.5,
                        business: 7.5,
                        timeliness: 7.5,
                        practicality: 7.5
                    }
                }
            }));
        }

        // Step 7: Apply soft limit - collect up to maxResults best papers
        const finalResults = opts.maxResults
            ? filteredResults.slice(0, opts.maxResults)
            : filteredResults;

        logger.info(`Collection limits applied`, {
            rawFound: rawResults.length,
            afterSearchLimit: limitedResults.length,
            afterDuplicateFilter: newResults.length,
            afterLLMFilter: filteredResults.length,
            finalLimit: finalResults.length,
            softLimit: opts.maxResults
        });

        // Step 8: Save to database
        const savedPapers: Array<{ id: string; title: string; url: string; relevanceScore: number }> = [];
        
        for (const { result, relevance } of finalResults) {
            try {
                // Process for tags
                const processed = await processPaper(result);
                
                // Merge LLM suggested tags with processor tags
                const allTags = [
                    ...processed.suggestedTags,
                    ...relevance.suggestedTags.map(name => ({ name, type: 'ai' }))
                ];
                
                // Dimension scores are now already in 1-10 range from content-filter
                const dimScores = relevance.dimensionScores;
                const technicalScore = dimScores.technical;
                const businessScore = dimScores.business;
                const timelinessScore = dimScores.timeliness;
                const practicalityScore = dimScores.practicality;
                
                // Calculate total relevance score as weighted average of dimensions
                // Weights: Technical 30%, Business 40%, Timeliness 10%, Practicality 20%
                const normalizedTotal = (
                    technicalScore * 0.30 +
                    businessScore * 0.40 +
                    timelinessScore * 0.10 +
                    practicalityScore * 0.20
                );
                
                logger.info(`[WEIGHTS] ${result.title.substring(0, 40)}... | Total: ${normalizedTotal.toFixed(2)} | Tech: ${technicalScore}×0.30=${(technicalScore*0.30).toFixed(2)} | Biz: ${businessScore}×0.40=${(businessScore*0.40).toFixed(2)} | Time: ${timelinessScore}×0.10=${(timelinessScore*0.10).toFixed(2)} | Pract: ${practicalityScore}×0.20=${(practicalityScore*0.20).toFixed(2)}`);
                
                // Create paper with relevance scores
                const paper = await prisma.paper.create({
                    data: {
                        title: result.title,
                        abstract: result.abstract,
                        url: result.url,
                        source: result.source,
                        publicationDate: result.publicationDate,
                        collectedAt: new Date(),
                        aiSummary: relevance.reasoning.substring(0, 500),
                        relevanceScore: normalizedTotal,
                        technicalScore: technicalScore,
                        businessScore: businessScore,
                        timelinessScore: timelinessScore,
                        practicalityScore: practicalityScore,
                        assessmentReason: relevance.reasoning
                    }
                });
                
                // Link tags
                for (const tag of allTags.slice(0, 5)) { // Limit to 5 tags
                    let dbTag = await prisma.tag.findUnique({ where: { name: tag.name } });
                    
                    if (!dbTag) {
                        dbTag = await prisma.tag.create({
                            data: { 
                                name: tag.name, 
                                type: tag.type,
                                category: relevance.matchedCategories[0]
                            }
                        });
                    }
                    
                    await prisma.paperTag.create({
                        data: {
                            paperId: paper.id,
                            tagId: dbTag.id
                        }
                    });
                }
                
                savedPapers.push({
                    id: paper.id,
                    title: paper.title,
                    url: paper.url,
                    relevanceScore: relevance.relevanceScore
                });
                
                // Log paper details
                logger.logPaperDetails({
                    title: paper.title,
                    relevanceScore: normalizedTotal,
                    technicalScore: technicalScore,
                    businessScore: businessScore,
                    timelinessScore: timelinessScore,
                    practicalityScore: practicalityScore,
                    tags: allTags.slice(0, 5).map(t => t.name),
                    source: result.source
                });
                
            } catch (error) {
                errors.push(`Failed to save paper "${result.title.substring(0, 30)}": ${(error as Error).message}`);
                logger.error('Failed to save paper', { error, title: result.title });
            }
        }

        // Step 9: Trigger alerts and revalidate
        if (savedPapers.length > 0) {
            revalidatePath('/');
            triggerCollectionAlerts(savedPapers.map(p => p.id)).catch(err => {
                logger.error('Alert trigger error', { error: err });
            });
        }

        const duration = Date.now() - startTime;
        
        // Build result message
        let message = `Collection complete. `;
        message += `Found ${rawResults.length} papers, `;
        if (duplicates.length > 0) message += `${duplicates.length} duplicates, `;
        if (newResults.length - finalResults.length > 0) {
            message += `${newResults.length - finalResults.length} filtered, `;
        }
        message += `${savedPapers.length} saved.`;
        if (opts.maxResults && savedPapers.length >= opts.maxResults) {
            message += ` (Reached soft limit of ${opts.maxResults})`;
        }

        // Log collection summary
        logger.logCollectionSummary({
            mode: opts.mode,
            query: opts.query || 'AI in banking',
            totalFound: rawResults.length,
            duplicates: duplicates.length,
            saved: savedPapers.length,
            duration: duration,
            optimizedQuery: undefined // Phase 2: Now using per-source queries
        });

        return {
            success: true,
            message,
            totalFound: rawResults.length,
            newCount: savedPapers.length,
            duplicateCount: duplicates.length,
            filteredCount: newResults.length - finalResults.length,
            stats: {
                rawFound: rawResults.length,
                afterSearchLimit: limitedResults.length,
                afterDuplicateFilter: newResults.length,
                afterLLMFilter: filteredResults.length,
                finalSaved: savedPapers.length
            },
            errors: errors.slice(0, 10), // Limit errors
            query: opts.query || 'AI in banking',
            optimizedQuery: undefined, // Phase 2: Now using per-source queries
            papers: savedPapers,
            duration
        };

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Collection failed', { error, mode: opts.mode });
        
        return {
            success: false,
            message: `Collection failed: ${(error as Error).message}`,
            totalFound: 0,
            newCount: 0,
            duplicateCount: 0,
            filteredCount: 0,
            errors: [...errors, (error as Error).message],
            query: opts.query || 'AI in banking',
            papers: [],
            duration
        };
    }
}

/**
 * Run auto-collection with default settings
 * Uses 3-month time range by default
 */
export async function runAutoCollection(overrideQuery?: string): Promise<CollectionResult> {
    // Default to past 1 week
    const today = new Date('2026-02-13'); // Current date
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    return runCollection({
        mode: 'auto',
        query: overrideQuery,
        dateFrom: oneWeekAgo.toISOString().split('T')[0],
        dateTo: today.toISOString().split('T')[0],
        horizon: 'custom'
    });
}

/**
 * Run manual collection - inherits auto mode base conditions
 * Allows user to override specific parameters while keeping defaults
 */
export async function runManualCollection(
    query: string,
    options?: Partial<CollectionOptions>
): Promise<CollectionResult> {
    return runCollection({
        mode: 'manual',
        query,
        ...options
    });
}

/**
 * Run pipeline collection with advanced settings
 */
export async function runPipelineCollection(
    query: string,
    options?: Partial<CollectionOptions>
): Promise<CollectionResult> {
    return runCollection({
        mode: 'pipeline',
        query,
        ...options
    });
}

// Helper functions
function calculateDateRange(opts: CollectionOptions): { sinceDate?: Date; toDate?: Date } {
    let sinceDate: Date | undefined;
    let toDate: Date | undefined;

    // Handle ISO date format (YYYY-MM-DD)
    if (opts.dateFrom) {
        if (opts.dateFrom.match(/^\d{4}-\d{2}-\d{2}$/)) {
            sinceDate = new Date(opts.dateFrom);
        } else if (opts.dateFrom.match(/^\d{4}$/)) {
            sinceDate = new Date(`${opts.dateFrom}-01-01`);
        }
    }
    
    if (opts.dateTo) {
        if (opts.dateTo.match(/^\d{4}-\d{2}-\d{2}$/)) {
            toDate = new Date(opts.dateTo);
        } else if (opts.dateTo.match(/^\d{4}$/)) {
            toDate = new Date(`${opts.dateTo}-12-31`);
        }
    }

    // If no custom dates, use horizon
    if (!sinceDate && opts.horizon) {
        const now = new Date('2026-02-13'); // Current date
        switch (opts.horizon) {
            case 'today':
                sinceDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case 'week':
                sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                sinceDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 3 months
                break;
            case 'year':
                sinceDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
        }
    }

    return { sinceDate, toDate };
}

async function getEnabledSources(specificSources?: string[]) {
    if (specificSources && specificSources.length > 0) {
        return prisma.source.findMany({
            where: { 
                name: { in: specificSources },
                enabled: true 
            }
        });
    }
    
    return prisma.source.findMany({
        where: { enabled: true }
    });
}

async function filterDuplicates(
    results: SearchResult[]
): Promise<{ newResults: SearchResult[]; duplicates: SearchResult[] }> {
    const newResults: SearchResult[] = [];
    const duplicates: SearchResult[] = [];
    
    // Get all existing URLs
    const existingPapers = await prisma.paper.findMany({
        select: { url: true, title: true }
    });
    
    const existingUrls = new Set(existingPapers.map(p => p.url.toLowerCase()));
    const existingTitles = new Set(existingPapers.map(p => 
        p.title.toLowerCase().replace(/[^\w\s]/g, '').trim()
    ));
    
    for (const result of results) {
        const normalizedUrl = result.url.toLowerCase();
        const normalizedTitle = result.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
        
        if (existingUrls.has(normalizedUrl) || existingTitles.has(normalizedTitle)) {
            duplicates.push(result);
        } else {
            newResults.push(result);
            // Add to sets to prevent duplicates within this batch
            existingUrls.add(normalizedUrl);
            existingTitles.add(normalizedTitle);
        }
    }
    
    return { newResults, duplicates };
}

async function filterContentWithLLM(
    results: SearchResult[],
    options: ContentFilterOptions
): Promise<Array<{ result: SearchResult; relevance: ContentRelevanceResult }>> {
    const filtered: Array<{ result: SearchResult; relevance: ContentRelevanceResult }> = [];
    
    // Process in batches to avoid overwhelming the LLM
    const batchSize = 5;
    
    for (let i = 0; i < results.length; i += batchSize) {
        const batch = results.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (result) => {
            const relevance = await checkContentRelevance(
                result.title,
                result.abstract,
                options
            );
            return { result, relevance };
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        // Filter based on relevance
        for (const item of batchResults) {
            if (item.relevance.isRelevant) {
                filtered.push(item);
            }
        }
    }
    
    // Sort by relevance score
    return filtered.sort((a, b) => b.relevance.relevanceScore - a.relevance.relevanceScore);
}

// Export utility functions
export async function getCollectionStats(): Promise<{
    totalPapers: number;
    papersThisWeek: number;
    papersThisMonth: number;
    lastCollectionDate?: Date;
}> {
    const now = new Date('2026-02-13'); // Current date
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const [totalPapers, papersThisWeek, papersThisMonth, lastPaper] = await Promise.all([
        prisma.paper.count({ where: { deletedAt: null } }),
        prisma.paper.count({ 
            where: { 
                collectedAt: { gte: weekAgo },
                deletedAt: null 
            } 
        }),
        prisma.paper.count({ 
            where: { 
                collectedAt: { gte: monthAgo },
                deletedAt: null 
            } 
        }),
        prisma.paper.findFirst({
            orderBy: { collectedAt: 'desc' },
            select: { collectedAt: true }
        })
    ]);
    
    return {
        totalPapers,
        papersThisWeek,
        papersThisMonth,
        lastCollectionDate: lastPaper?.collectedAt
    };
}
