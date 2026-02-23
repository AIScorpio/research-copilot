/**
 * Dry Run - Concurrent LLM Test
 * 
 * Purpose: Simulate actual auto-collection behavior to identify fallback triggers
 * 
 * Configuration (from config/collection.json):
 * - autoDefaultQuery: "AI in banking"
 * - maxResults: 20
 * - batchSize: 5 (from collection-service.ts)
 * - Concurrent LLM calls via Promise.all
 */

import { prisma } from '../src/lib/db';
import { checkContentRelevance, ContentFilterOptions } from '../src/lib/content-filter';
import { generateTagsWithLLM } from '../src/lib/tag-generator';
import { generateSummary } from '../src/lib/summary-generator';
import { optimizeQuery, OptimizedQuery } from '../src/lib/query-optimizer';
import { searchOnline, SearchResult } from '../src/lib/collector';
import { ensureLLMInitialized } from '../src/lib/llm-service';
import { loadCollectionConfig } from '../src/lib/collection-config';

// Configuration - matches actual collection
const CONFIG = {
    autoDefaultQuery: 'AI in banking',
    maxResults: 20,
    batchSize: 5,  // From collection-service.ts
    minRelevanceScore: 60,
    dateRangeDays: 90  // Extended for testing
};

async function runConcurrentTest() {
    console.log('================================================================================');
    console.log('CONCURRENT LLM TEST - Simulating Real Auto-Collection');
    console.log('================================================================================');
    console.log('');
    console.log('Configuration:');
    console.log(`  Query: "${CONFIG.autoDefaultQuery}"`);
    console.log(`  Max Results: ${CONFIG.maxResults}`);
    console.log(`  Batch Size: ${CONFIG.batchSize} (concurrent LLM calls per batch)`);
    console.log(`  Min Relevance Score: ${CONFIG.minRelevanceScore}`);
    console.log('');
    console.log('⚠️  This test uses Promise.all to simulate actual concurrent behavior');
    console.log('⚠️  Watch logs/llm-*.log for rate limit / fallback warnings');
    console.log('');

    const startTime = Date.now();
    const stats = {
        queryOptimization: { success: 0, fallback: 0 },
        contentAssessment: { success: 0, fallback: 0, failed: 0 },
        tagGeneration: { success: 0, failed: 0 },
        summaryGeneration: { success: 0, failed: 0 }
    };

    try {
        // Step 0: Initialize LLM
        console.log('### Step 0: Initialize LLM ###');
        await ensureLLMInitialized('system');
        console.log('LLM initialized');
        console.log('');

        // Step 1: Query Optimization (same as actual collection)
        console.log('### Step 1: Query Optimization ###');
        const optimizedQuery: OptimizedQuery = await optimizeQuery(CONFIG.autoDefaultQuery, {
            strictness: 'balanced',
            useConfigPrompt: true
        });
        
        console.log(`  Original: "${CONFIG.autoDefaultQuery}"`);
        console.log(`  Optimized: "${optimizedQuery.optimizedQuery.substring(0, 80)}..."`);
        console.log(`  Source: ${optimizedQuery.source}`);
        stats.queryOptimization.success = optimizedQuery.source === 'llm' ? 1 : 0;
        stats.queryOptimization.fallback = optimizedQuery.source === 'fallback' ? 1 : 0;
        console.log('');

        // Step 2: Search (simulated - use optimized query)
        console.log('### Step 2: Search ArXiv ###');
        const toDate = new Date();
        const fromDate = new Date(toDate.getTime() - CONFIG.dateRangeDays * 24 * 60 * 60 * 1000);
        
        console.log(`  Date Range: ${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`);
        
        // Fetch enabled sources from database (like actual collection)
        const sources = await prisma.source.findMany({
            where: { enabled: true }
        });
        console.log(`  Enabled Sources: ${sources.map(s => s.name).join(', ')}`);
        
        const results: SearchResult[] = await searchOnline(
            optimizedQuery.optimizedQuery,
            fromDate,
            toDate,
            sources,  // Use enabled sources from DB
            10   // Limit to 10 for test
        );
        
        console.log(`  Results Found: ${results.length}`);
        console.log('');

        if (results.length === 0) {
            console.log('No results found. Test complete.');
            return;
        }

        // Step 3: Content Assessment - CONCURRENT (like actual collection)
        console.log('### Step 3: Content Assessment (CONCURRENT) ###');
        console.log(`  Processing ${results.length} papers in batches of ${CONFIG.batchSize}`);
        console.log('');

        const filterOptions: ContentFilterOptions = {
            minRelevanceScore: CONFIG.minRelevanceScore / 10,  // Convert to 1-10 scale
            requireBankingContext: true,
            requireAITechnology: false
        };

        const allAssessments: Array<{ result: SearchResult; relevance: any }> = [];

        // Process in batches - SAME AS ACTUAL COLLECTION
        for (let i = 0; i < results.length; i += CONFIG.batchSize) {
            const batch = results.slice(i, i + CONFIG.batchSize);
            const batchNum = Math.floor(i / CONFIG.batchSize) + 1;
            
            console.log(`  Batch ${batchNum}: Processing ${batch.length} papers CONCURRENTLY...`);
            
            // CONCURRENT LLM CALLS - This is what we're testing!
            const batchStart = Date.now();
            const batchPromises = batch.map(async (result) => {
                const callStart = Date.now();
                try {
                    const relevance = await checkContentRelevance(
                        result.title,
                        result.abstract,
                        filterOptions
                    );
                    const callDuration = Date.now() - callStart;
                    return {
                        result,
                        relevance,
                        callDuration,
                        isFallback: relevance.reasoning?.includes('Fallback') || false,
                        error: null
                    };
                } catch (error: any) {
                    const callDuration = Date.now() - callStart;
                    return {
                        result,
                        relevance: null,
                        callDuration,
                        isFallback: false,
                        error: error.message
                    };
                }
            });

            // THIS IS WHERE CONCURRENT CALLS HAPPEN
            const batchResults = await Promise.all(batchPromises);
            const batchDuration = Date.now() - batchStart;

            // Analyze batch results
            let batchSuccess = 0;
            let batchFallback = 0;
            let batchFailed = 0;

            batchResults.forEach((r, idx) => {
                const paperNum = i + idx + 1;
                if (r.error) {
                    console.log(`    Paper ${paperNum}: ❌ FAILED (${r.callDuration}ms)`);
                    console.log(`      Error: ${r.error}`);
                    batchFailed++;
                    stats.contentAssessment.failed++;
                } else if (r.isFallback) {
                    console.log(`    Paper ${paperNum}: ⚠️  FALLBACK (${r.callDuration}ms)`);
                    batchFallback++;
                    stats.contentAssessment.fallback++;
                } else {
                    console.log(`    Paper ${paperNum}: ✅ LLM (${r.callDuration}ms) - Score: ${r.relevance?.relevanceScore?.toFixed(2)}`);
                    batchSuccess++;
                    stats.contentAssessment.success++;
                }
            });

            console.log(`  Batch ${batchNum} Summary: ${batchSuccess} success, ${batchFallback} fallback, ${batchFailed} failed (${batchDuration}ms total)`);
            console.log('');

            // Collect relevant papers
            batchResults.forEach(r => {
                if (r.relevance?.isRelevant) {
                    allAssessments.push({ result: r.result, relevance: r.relevance });
                }
            });
        }

        console.log(`Total Content Assessment: ${stats.contentAssessment.success} success, ${stats.contentAssessment.fallback} fallback, ${stats.contentAssessment.failed} failed`);
        console.log('');

        // Step 4: Tag Generation & Summary - Also concurrent in actual collection
        if (allAssessments.length > 0) {
            console.log('### Step 4: Tag Generation & Summary (CONCURRENT) ###');
            console.log(`  Processing ${allAssessments.length} relevant papers`);
            console.log('');

            const papersToProcess = allAssessments.slice(0, 5); // Limit for test

            for (let i = 0; i < papersToProcess.length; i += CONFIG.batchSize) {
                const batch = papersToProcess.slice(i, i + CONFIG.batchSize);
                const batchNum = Math.floor(i / CONFIG.batchSize) + 1;

                console.log(`  Batch ${batchNum}: Processing ${batch.length} papers CONCURRENTLY...`);

                // Concurrent tag generation
                const tagPromises = batch.map(async ({ result }) => {
                    try {
                        await generateTagsWithLLM(result.title, result.abstract, []);
                        return { success: true };
                    } catch (error: any) {
                        return { success: false, error: error.message };
                    }
                });

                const tagResults = await Promise.all(tagPromises);
                const tagSuccess = tagResults.filter(r => r.success).length;
                const tagFailed = tagResults.filter(r => !r.success).length;
                stats.tagGeneration.success += tagSuccess;
                stats.tagGeneration.failed += tagFailed;

                console.log(`    Tags: ${tagSuccess} success, ${tagFailed} failed`);
            }

            console.log('');
        }

        // Summary Report
        console.log('================================================================================');
        console.log('TEST COMPLETE');
        console.log('================================================================================');
        console.log('');
        console.log('Statistics:');
        console.log('');
        console.log('Query Optimization:');
        console.log(`  LLM Success: ${stats.queryOptimization.success}`);
        console.log(`  Fallback:    ${stats.queryOptimization.fallback}`);
        console.log('');
        console.log('Content Assessment (CONCURRENT):');
        console.log(`  LLM Success: ${stats.contentAssessment.success}`);
        console.log(`  Fallback:    ${stats.contentAssessment.fallback}`);
        console.log(`  Failed:      ${stats.contentAssessment.failed}`);
        console.log(`  Fallback Rate: ${((stats.contentAssessment.fallback / (stats.contentAssessment.success + stats.contentAssessment.fallback + stats.contentAssessment.failed)) * 100).toFixed(1)}%`);
        console.log('');
        console.log('Tag Generation:');
        console.log(`  Success: ${stats.tagGeneration.success}`);
        console.log(`  Failed:  ${stats.tagGeneration.failed}`);
        console.log('');
        console.log('Check logs/ for detailed information:');
        console.log('  - logs/llm-*.log (LLM call details, rate limits)');
        console.log('  - logs/collection-*.log (Collection flow)');
        console.log('  - logs/error-*.log (Errors)');
        console.log('');

    } catch (error: any) {
        console.error('');
        console.error('ERROR:', error.message);
        console.error(error.stack);
    } finally {
        const totalDuration = Date.now() - startTime;
        console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
        console.log('');

        await prisma.$disconnect();
    }
}

runConcurrentTest();
