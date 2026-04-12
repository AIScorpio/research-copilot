/**
 * Enhanced Collection Service - Orchestrates the full collection flow
 * Features:
 * - LLM-powered query optimization
 * - Multi-source collection
 * - Database duplicate detection
 * - LLM-powered content filtering
 * - Configurable limits and modes
 * - Configuration from config/collection.json
 */

import { searchOnline, SearchResult } from './collector';
import { optimizeQuery, OptimizedQuery, QueryOptimizationOptions } from './query-optimizer';
import { checkContentRelevance, ContentFilterOptions, ContentRelevanceResult } from './content-filter';
import { processPaper } from './processor';
import { prisma } from './db';
import { logger } from './logger';
import { revalidatePath } from 'next/cache';
import { digestEngine } from './daily-digest/engine';
import { getBeijingDateCode } from './timezone-utils';
import { inferSourceTypeFromName } from './source-type-service';
import { loadCollectionConfig } from './collection-config';

export type CollectionMode = 'auto' | 'pipeline';

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
// maxResults will be loaded from config/collection.json in runCollection
const MODE_DEFAULTS: Record<CollectionMode, Partial<CollectionOptions>> = {
    auto: {
        ...BASE_CONFIG,
        horizon: 'month',
        minRelevanceScore: 5, // 1-10 scale: 5 is minimum for "partially relevant"
        focusAreas: ['risk-management', 'compliance', 'fraud-detection', 'credit-assessment']
    },
    pipeline: {
        ...BASE_CONFIG,
        horizon: 'year',
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

    // Load collection config for maxResults
    const config = await loadCollectionConfig();
    
    // Merge options: BASE_CONFIG -> MODE_DEFAULTS -> user options
    // Filter out undefined values so they don't overwrite defaults (except mode which is required)
    const { mode, ...restOptions } = options;
    const userOptions = Object.fromEntries(
        Object.entries(restOptions).filter(([_, v]) => v !== undefined)
    );
    
    const opts = {
        ...BASE_CONFIG,
        ...MODE_DEFAULTS[mode],
        maxResults: config.maxResults, // Use config value instead of hardcoded
        ...userOptions,
        mode
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
                    strictness: opts.queryStrictness || 'balanced',
                    mode: opts.mode
                };
                
                optimizedQuery = await optimizeQuery(searchQuery, optimizationOptions);
                searchQuery = optimizedQuery.optimizedQuery;
                
                logger.info('[COLLECTION] Query optimized', {
                    original: optimizedQuery.originalQuery,
                    optimized: optimizedQuery.optimizedQuery,
                    source: optimizedQuery.source
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
            to: toDate?.toISOString(),
            limit: opts.maxResults
        });

        const rawResults = await searchOnline(searchQuery, sinceDate, toDate, sources, opts.maxResults);
        
        logger.debug(`Found ${rawResults.length} raw results`);

        // Step 5: Check database for duplicates
        const { newResults, duplicates } = opts.skipDuplicates !== false
            ? await filterDuplicates(rawResults)
            : { newResults: rawResults, duplicates: [] };
        
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
            afterSearchLimit: rawResults.length,
            afterDuplicateFilter: newResults.length,
            afterLLMFilter: filteredResults.length,
            finalLimit: finalResults.length,
            softLimit: opts.maxResults
        });

        // Step 8: Save to database
        const savedPapers: Array<{ id: string; title: string; url: string; relevanceScore: number }> = [];
        
        for (const { result, relevance } of finalResults) {
            try {
                const processed = await processPaper(result);
                
                const allTags = processed.suggestedTags;
                const uniqueTags = [...new Map(allTags.map(t => [t.name, t])).values()].slice(0, 5);
                
                const dimScores = relevance.dimensionScores;
                const technicalScore = dimScores.technical;
                const businessScore = dimScores.business;
                const timelinessScore = dimScores.timeliness;
                const practicalityScore = dimScores.practicality;
                
                const normalizedTotal = relevance.relevanceScore;
                const technicalBonusApplied = relevance.technicalBonusApplied || false;
                
                logger.info(`[WEIGHTS] ${result.title.substring(0, 40)}... | Total: ${normalizedTotal.toFixed(2)} | Tech: ${technicalScore} | Biz: ${businessScore} | Time: ${timelinessScore} | Pract: ${practicalityScore} | Bonus: ${technicalBonusApplied ? '1.05x' : 'none'}`);
                
                const sourceType = await inferSourceTypeFromName(result.source);
                
                const paper = await prisma.$transaction(async (tx) => {
                    const createdPaper = await tx.paper.create({
                        data: {
                            title: result.title,
                            abstract: result.abstract,
                            url: result.url,
                            source: result.source,
                            sourceType: sourceType,
                            publicationDate: result.publicationDate,
                            collectedAt: new Date(),
                            relevanceScore: normalizedTotal,
                            technicalScore: technicalScore,
                            businessScore: businessScore,
                            timelinessScore: timelinessScore,
                            practicalityScore: practicalityScore,
                            assessmentReason: relevance.reasoning,
                            technicalBonusApplied: technicalBonusApplied
                        }
                    });
                    
                    for (const tag of uniqueTags) {
                        const dbTag = await tx.tag.upsert({
                            where: { name: tag.name },
                            update: {},
                            create: {
                                name: tag.name,
                                category: tag.category || 'uncategorized'
                            }
                        });
                        
                        await tx.paperTag.create({
                            data: {
                                paperId: createdPaper.id,
                                tagId: dbTag.id
                            }
                        });
                    }
                    
                    return createdPaper;
                });
                
                savedPapers.push({
                    id: paper.id,
                    title: paper.title,
                    url: paper.url,
                    relevanceScore: relevance.relevanceScore
                });
                
                logger.logPaperDetails({
                    title: paper.title,
                    relevanceScore: normalizedTotal,
                    technicalScore: technicalScore,
                    businessScore: businessScore,
                    timelinessScore: timelinessScore,
                    practicalityScore: practicalityScore,
                    tags: uniqueTags.map(t => t.name),
                    source: result.source
                });
                
            } catch (error) {
                errors.push(`Failed to save paper "${result.title.substring(0, 30)}": ${(error as Error).message}`);
                logger.error('Failed to save paper', { error, title: result.title });
            }
        }

        // Step 9: Trigger daily digest generation and revalidate
        if (savedPapers.length > 0) {
            revalidatePath('/');
            
            // Trigger Daily Digest generation (Phase 2 system)
            // Use Beijing Time (UTC+8) as anchor for consistency across all environments
            const today = getBeijingDateCode();
            console.log(`[Collection] Triggering digest for Beijing date: ${today}`);
            digestEngine.triggerDailyDigestUpdate(today).catch(err => {
                logger.error('Daily digest generation error', { error: err });
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
                afterSearchLimit: rawResults.length,
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
 * Run auto-collection with settings from config/collection.json
 * Uses autoTimeRangeDays and autoDefaultQuery from config
 */
export async function runAutoCollection(overrideQuery?: string): Promise<CollectionResult> {
    // Load configuration
    const config = await loadCollectionConfig();
    
    // Use config values
    const timeRangeDays = config.autoTimeRangeDays;
    const query = overrideQuery || config.autoDefaultQuery;
    
    const today = new Date();
    const startDate = new Date(today.getTime() - timeRangeDays * 24 * 60 * 60 * 1000);

    logger.info('Starting auto-collection', { 
        query, 
        timeRangeDays,
        maxResults: config.maxResults 
    });

    return runCollection({
        mode: 'auto',
        query,
        dateFrom: startDate.toISOString().split('T')[0],
        dateTo: today.toISOString().split('T')[0],
        horizon: 'custom',
        maxResults: config.maxResults
    });
}

/**
 * Run pipeline collection with advanced settings
 */
export async function runPipelineCollection(
    query: string,
    options?: Partial<CollectionOptions>
): Promise<CollectionResult> {
    // Load configuration for maxResults
    const config = await loadCollectionConfig();
    
    return runCollection({
        mode: 'pipeline',
        query,
        maxResults: config.maxResults,
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
        const now = new Date();
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
    
    const existingUrls = new Set(existingPapers.map((p: { url: string; title: string }) => p.url.toLowerCase()));
    const existingTitles = new Set(existingPapers.map((p: { url: string; title: string }) => 
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
    const rejected: Array<{ result: SearchResult; relevance: ContentRelevanceResult }> = [];

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
            } else {
                rejected.push(item);
            }
        }
    }

    // Log rejected papers with details
    for (const { result, relevance } of rejected) {
        logger.info('[COLLECTION] Paper rejected', {
            title: result.title,
            abstract: result.abstract.substring(0, 200) + (result.abstract.length > 200 ? '...' : ''),
            relevanceScore: relevance.relevanceScore.toFixed(2),
            dimensionScores: {
                technical: relevance.dimensionScores.technical,
                business: relevance.dimensionScores.business,
                timeliness: relevance.dimensionScores.timeliness,
                practicality: relevance.dimensionScores.practicality
            },
            reasoning: relevance.reasoning,
            source: result.source
        });
    }

    if (rejected.length > 0) {
        logger.info('[COLLECTION] Filtering summary', {
            total: results.length,
            accepted: filtered.length,
            rejected: rejected.length
        });
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
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const [totalPapers, papersThisWeek, papersThisMonth, lastPaper] = await Promise.all([
        prisma.paper.count(),
        prisma.paper.count({
            where: {
                collectedAt: { gte: weekAgo }
            }
        }),
        prisma.paper.count({
            where: {
                collectedAt: { gte: monthAgo }
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
