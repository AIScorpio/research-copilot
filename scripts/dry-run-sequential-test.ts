/**
 * Dry Run - Sequential LLM Test with Rate Limit Protection
 * 
 * Purpose: Measure timing and tokens per paper for all LLM operations
 * Sequential processing with delays to stay under Groq rate limits
 * 
 * Kimi K2 Rate Limits (moonshotai/kimi-k2-instruct):
 * - RPM: 60
 * - TPM: 10,000
 * - TPD: 300,000
 */

import { prisma } from '../src/lib/db';
import { checkContentRelevance, ContentFilterOptions } from '../src/lib/content-filter';
import { generateTagsWithLLM } from '../src/lib/tag-generator';
import { generateSummary } from '../src/lib/summary-generator';
import { optimizeQuery, OptimizedQuery } from '../src/lib/query-optimizer';
import { searchOnline, SearchResult } from '../src/lib/collector';
import { ensureLLMInitialized } from '../src/lib/llm-service';

const CONFIG = {
    autoDefaultQuery: 'AI in banking',
    maxResults: 20,
    minRelevanceScore: 60,
    dateRangeDays: 90,
    // Rate limit protection: 10K TPM / ~2500 tokens per paper = 4 papers/min = 15s delay
    delayBetweenPapersMs: 15000
};

// Estimate tokens (rough: 1 token ≈ 4 characters)
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

interface TimingMetrics {
    operation: string;
    durationMs: number;
    estimatedTokens: number;
    success: boolean;
    error?: string;
}

interface PaperMetrics {
    index: number;
    title: string;
    timings: TimingMetrics[];
    totalTimeMs: number;
    totalTokens: number;
    isRelevant: boolean;
}

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSequentialTest() {
    console.log('================================================================================');
    console.log('SEQUENTIAL LLM TEST - Per-Paper Timing & Token Analysis');
    console.log('================================================================================');
    console.log('');
    console.log('Configuration:');
    console.log(`  Query: "${CONFIG.autoDefaultQuery}"`);
    console.log(`  Max Results: ${CONFIG.maxResults}`);
    console.log(`  Processing: SEQUENTIAL (one paper at a time)`);
    console.log(`  Delay Between Papers: ${CONFIG.delayBetweenPapersMs / 1000}s (rate limit protection)`);
    console.log('');
    console.log('Rate Limits (Kimi K2 on Groq):');
    console.log(`  TPM: 10,000 tokens/minute`);
    console.log(`  TPD: 300,000 tokens/day`);
    console.log('');

    const startTime = Date.now();
    const allPaperMetrics: PaperMetrics[] = [];
    const allTimings: TimingMetrics[] = [];
    let totalTokensUsed = 0;

    try {
        // Step 0: Initialize LLM
        console.log('### Step 0: Initialize LLM ###');
        const initStart = Date.now();
        await ensureLLMInitialized('system');
        const initDuration = Date.now() - initStart;
        console.log(`  LLM initialized (${initDuration}ms)`);
        console.log('');

        // Step 1: Query Optimization
        console.log('### Step 1: Query Optimization ###');
        const queryOptStart = Date.now();
        const optimizedQuery: OptimizedQuery = await optimizeQuery(CONFIG.autoDefaultQuery, {
            strictness: 'balanced',
            useConfigPrompt: true
        });
        const queryOptDuration = Date.now() - queryOptStart;
        
        // Estimate tokens for query optimization (prompt + response)
        const queryOptTokens = estimateTokens(CONFIG.autoDefaultQuery) + estimateTokens(optimizedQuery.optimizedQuery);
        
        console.log(`  Original: "${CONFIG.autoDefaultQuery}"`);
        console.log(`  Optimized: "${optimizedQuery.optimizedQuery.substring(0, 60)}..."`);
        console.log(`  Source: ${optimizedQuery.source}`);
        console.log(`  Duration: ${queryOptDuration}ms`);
        console.log(`  Estimated Tokens: ${queryOptTokens}`);
        console.log('');

        totalTokensUsed += queryOptTokens;

        // Step 2: Search
        console.log('### Step 2: Search ArXiv ###');
        const toDate = new Date();
        const fromDate = new Date(toDate.getTime() - CONFIG.dateRangeDays * 24 * 60 * 60 * 1000);
        
        console.log(`  Date Range: ${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`);
        
        const sources = await prisma.source.findMany({
            where: { enabled: true }
        });
        console.log(`  Enabled Sources: ${sources.map(s => s.name).join(', ')}`);
        
        const searchStart = Date.now();
        const results: SearchResult[] = await searchOnline(
            optimizedQuery.optimizedQuery,
            fromDate,
            toDate,
            sources,
            CONFIG.maxResults
        );
        const searchDuration = Date.now() - searchStart;
        
        console.log(`  Results Found: ${results.length} (${searchDuration}ms)`);
        console.log('');

        if (results.length === 0) {
            console.log('No results found. Test complete.');
            return;
        }

        // Step 3: Process each paper SEQUENTIALLY
        console.log('### Step 3: Process Papers SEQUENTIALLY ###');
        console.log(`  Processing ${results.length} papers one at a time`);
        console.log(`  With ${CONFIG.delayBetweenPapersMs / 1000}s delay between papers`);
        console.log('');

        const filterOptions: ContentFilterOptions = {
            minRelevanceScore: CONFIG.minRelevanceScore / 10,
            requireBankingContext: true,
            requireAITechnology: false
        };

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const paperStart = Date.now();
            const paperTimings: TimingMetrics[] = [];
            let paperTokens = 0;
            
            console.log(`--- Paper ${i + 1}/${results.length}: ${result.title.substring(0, 50)}... ---`);

            // 3a: Content Assessment
            const assessStart = Date.now();
            let relevance: any = null;
            let assessSuccess = false;
            let assessError: string | undefined;
            try {
                relevance = await checkContentRelevance(
                    result.title,
                    result.abstract,
                    filterOptions
                );
                assessSuccess = true;
            } catch (error: any) {
                assessError = error.message;
                console.log(`    Content Assessment FAILED: ${assessError}`);
            }
            const assessDuration = Date.now() - assessStart;
            
            // Estimate tokens: title + abstract + prompt + response
            const assessTokens = estimateTokens(result.title) + estimateTokens(result.abstract) + 500 + 200;
            paperTokens += assessTokens;
            
            paperTimings.push({
                operation: 'content_assessment',
                durationMs: assessDuration,
                estimatedTokens: assessTokens,
                success: assessSuccess,
                error: assessError
            });
            
            console.log(`    Content Assessment: ${assessDuration}ms | ~${assessTokens} tokens | Score: ${relevance?.relevanceScore?.toFixed(2) || 'N/A'} | ${relevance?.isRelevant ? 'RELEVANT' : 'NOT RELEVANT'}`);

            // Only continue if relevant
            if (!relevance?.isRelevant) {
                const paperTotal = Date.now() - paperStart;
                allPaperMetrics.push({
                    index: i + 1,
                    title: result.title,
                    timings: paperTimings,
                    totalTimeMs: paperTotal,
                    totalTokens: paperTokens,
                    isRelevant: false
                });
                totalTokensUsed += paperTokens;
                console.log(`    Paper total: ${paperTotal}ms | ~${paperTokens} tokens (filtered out)`);
                console.log('');
                
                // Delay even for filtered papers
                if (i < results.length - 1) {
                    console.log(`    [Waiting ${CONFIG.delayBetweenPapersMs / 1000}s for rate limit...]`);
                    await sleep(CONFIG.delayBetweenPapersMs);
                }
                continue;
            }

            // 3b: Tag Generation
            const tagStart = Date.now();
            let tagSuccess = false;
            let tagError: string | undefined;
            try {
                await generateTagsWithLLM(result.title, result.abstract, []);
                tagSuccess = true;
            } catch (error: any) {
                tagError = error.message;
                console.log(`    Tag Generation FAILED: ${tagError}`);
            }
            const tagDuration = Date.now() - tagStart;
            
            // Estimate tokens: title + abstract + prompt + tags response
            const tagTokens = estimateTokens(result.title) + estimateTokens(result.abstract) + 400 + 300;
            paperTokens += tagTokens;
            
            paperTimings.push({
                operation: 'tag_generation',
                durationMs: tagDuration,
                estimatedTokens: tagTokens,
                success: tagSuccess,
                error: tagError
            });
            
            console.log(`    Tag Generation: ${tagDuration}ms | ~${tagTokens} tokens | ${tagSuccess ? 'SUCCESS' : 'FAILED'}`);

            // 3c: Summary Generation
            const summaryStart = Date.now();
            let summarySuccess = false;
            let summaryError: string | undefined;
            try {
                await generateSummary(result.title, result.abstract);
                summarySuccess = true;
            } catch (error: any) {
                summaryError = error.message;
                console.log(`    Summary Generation FAILED: ${summaryError}`);
            }
            const summaryDuration = Date.now() - summaryStart;
            
            // Estimate tokens: title + abstract + prompt + summary response
            const summaryTokens = estimateTokens(result.title) + estimateTokens(result.abstract) + 200 + 400;
            paperTokens += summaryTokens;
            
            paperTimings.push({
                operation: 'summary_generation',
                durationMs: summaryDuration,
                estimatedTokens: summaryTokens,
                success: summarySuccess,
                error: summaryError
            });
            
            console.log(`    Summary Generation: ${summaryDuration}ms | ~${summaryTokens} tokens | ${summarySuccess ? 'SUCCESS' : 'FAILED'}`);

            const paperTotal = Date.now() - paperStart;
            allPaperMetrics.push({
                index: i + 1,
                title: result.title,
                timings: paperTimings,
                totalTimeMs: paperTotal,
                totalTokens: paperTokens,
                isRelevant: true
            });
            
            allTimings.push(...paperTimings);
            totalTokensUsed += paperTokens;
            
            console.log(`    Paper total: ${paperTotal}ms | ~${paperTokens} tokens`);
            console.log('');
            
            // Delay between papers to stay under TPM
            if (i < results.length - 1) {
                console.log(`    [Waiting ${CONFIG.delayBetweenPapersMs / 1000}s for rate limit...]`);
                await sleep(CONFIG.delayBetweenPapersMs);
            }
        }

        // Summary Report
        console.log('================================================================================');
        console.log('TIMING & TOKEN ANALYSIS SUMMARY');
        console.log('================================================================================');
        console.log('');

        // Calculate averages by operation type
        const operationTypes = ['content_assessment', 'tag_generation', 'summary_generation'];
        
        console.log('Per-Operation Averages:');
        console.log('');
        
        const opAverages: Record<string, { duration: number; tokens: number; successRate: number }> = {};
        
        for (const op of operationTypes) {
            const opTimings = allTimings.filter(t => t.operation === op);
            if (opTimings.length > 0) {
                const avgDuration = opTimings.reduce((sum, t) => sum + t.durationMs, 0) / opTimings.length;
                const avgTokens = opTimings.reduce((sum, t) => sum + t.estimatedTokens, 0) / opTimings.length;
                const successRate = (opTimings.filter(t => t.success).length / opTimings.length) * 100;
                const minDuration = Math.min(...opTimings.map(t => t.durationMs));
                const maxDuration = Math.max(...opTimings.map(t => t.durationMs));
                
                opAverages[op] = { duration: avgDuration, tokens: avgTokens, successRate };
                
                console.log(`  ${op}:`);
                console.log(`    Count: ${opTimings.length}`);
                console.log(`    Average Duration: ${avgDuration.toFixed(0)}ms`);
                console.log(`    Average Tokens: ${avgTokens.toFixed(0)}`);
                console.log(`    Min/Max Duration: ${minDuration}ms / ${maxDuration}ms`);
                console.log(`    Success Rate: ${successRate.toFixed(1)}%`);
                console.log('');
            }
        }

        // Per-paper totals
        const relevantPapers = allPaperMetrics.filter(p => p.isRelevant);
        const filteredPapers = allPaperMetrics.filter(p => !p.isRelevant);
        const successPapers = allPaperMetrics.filter(p => p.timings.every(t => t.success));
        
        console.log('Paper Processing Summary:');
        console.log(`  Total Papers: ${allPaperMetrics.length}`);
        console.log(`  Successful (all ops): ${successPapers.length}`);
        console.log(`  Relevant: ${relevantPapers.length}`);
        console.log(`  Filtered Out: ${filteredPapers.length}`);
        console.log('');
        
        if (successPapers.length > 0) {
            const avgPaperTime = successPapers.reduce((sum, p) => sum + p.totalTimeMs, 0) / successPapers.length;
            const avgPaperTokens = successPapers.reduce((sum, p) => sum + p.totalTokens, 0) / successPapers.length;
            
            console.log('Per-Successful-Paper (all 3 LLM ops):');
            console.log(`  Average Time: ${avgPaperTime.toFixed(0)}ms (${(avgPaperTime / 1000).toFixed(1)}s)`);
            console.log(`  Average Tokens: ${avgPaperTokens.toFixed(0)}`);
            console.log('');
        }

        if (filteredPapers.length > 0) {
            const avgFilteredTime = filteredPapers.reduce((sum, p) => sum + p.totalTimeMs, 0) / filteredPapers.length;
            const avgFilteredTokens = filteredPapers.reduce((sum, p) => sum + p.totalTokens, 0) / filteredPapers.length;
            
            console.log('Per-Filtered-Paper (content assessment only):');
            console.log(`  Average Time: ${avgFilteredTime.toFixed(0)}ms (${(avgFilteredTime / 1000).toFixed(1)}s)`);
            console.log(`  Average Tokens: ${avgFilteredTokens.toFixed(0)}`);
            console.log('');
        }

        console.log('Total Tokens Used (this run):');
        console.log(`  ${totalTokensUsed.toLocaleString()} tokens`);
        console.log(`  % of TPD (300K): ${((totalTokensUsed / 300000) * 100).toFixed(2)}%`);
        console.log('');

        // 100-paper scenario calculation
        console.log('================================================================================');
        console.log('100-PAPER SCENARIO ANALYSIS');
        console.log('================================================================================');
        console.log('');

        // Only use data from successfully processed papers
        const successTimings = allTimings.filter(t => t.success);
        
        if (successTimings.length > 0) {
            const avgCA = successTimings.filter(t => t.operation === 'content_assessment').reduce((s, t) => s + t.durationMs, 0) / successTimings.filter(t => t.operation === 'content_assessment').length || 0;
            const avgCA_Tokens = successTimings.filter(t => t.operation === 'content_assessment').reduce((s, t) => s + t.estimatedTokens, 0) / successTimings.filter(t => t.operation === 'content_assessment').length || 0;
            
            const avgTG = successTimings.filter(t => t.operation === 'tag_generation').reduce((s, t) => s + t.durationMs, 0) / successTimings.filter(t => t.operation === 'tag_generation').length || 0;
            const avgTG_Tokens = successTimings.filter(t => t.operation === 'tag_generation').reduce((s, t) => s + t.estimatedTokens, 0) / successTimings.filter(t => t.operation === 'tag_generation').length || 0;
            
            const avgSG = successTimings.filter(t => t.operation === 'summary_generation').reduce((s, t) => s + t.durationMs, 0) / successTimings.filter(t => t.operation === 'summary_generation').length || 0;
            const avgSG_Tokens = successTimings.filter(t => t.operation === 'summary_generation').reduce((s, t) => s + t.estimatedTokens, 0) / successTimings.filter(t => t.operation === 'summary_generation').length || 0;

            console.log('Measured Averages (from successful ops):');
            console.log(`  Content Assessment: ${avgCA.toFixed(0)}ms, ~${avgCA_Tokens.toFixed(0)} tokens`);
            console.log(`  Tag Generation: ${avgTG.toFixed(0)}ms, ~${avgTG_Tokens.toFixed(0)} tokens`);
            console.log(`  Summary Generation: ${avgSG.toFixed(0)}ms, ~${avgSG_Tokens.toFixed(0)} tokens`);
            
            const totalPerRelevantPaper = avgCA + avgTG + avgSG;
            const tokensPerRelevantPaper = avgCA_Tokens + avgTG_Tokens + avgSG_Tokens;
            
            console.log(`  Per Relevant Paper: ${totalPerRelevantPaper.toFixed(0)}ms, ~${tokensPerRelevantPaper.toFixed(0)} tokens`);
            console.log('');

            // Calculate required delay to stay under TPM
            const tpmLimit = 10000;
            const safeDelayMs = Math.ceil((tokensPerRelevantPaper / tpmLimit) * 60000);
            
            console.log('Rate Limit Considerations:');
            console.log(`  TPM Limit: ${tpmLimit.toLocaleString()} tokens/minute`);
            console.log(`  Tokens per relevant paper: ~${tokensPerRelevantPaper.toFixed(0)}`);
            console.log(`  Max papers/minute (no delay): ${(tpmLimit / tokensPerRelevantPaper).toFixed(1)}`);
            console.log(`  Recommended delay between papers: ${safeDelayMs}ms (${(safeDelayMs / 1000).toFixed(1)}s)`);
            console.log('');

            console.log('--- Scenario A: 100 papers, NONE filtered (worst case) ---');
            const scenarioA_time = 100 * (totalPerRelevantPaper + CONFIG.delayBetweenPapersMs);
            const scenarioA_tokens = 100 * tokensPerRelevantPaper;
            console.log(`  Processing time: ${(scenarioA_time / 60000).toFixed(1)} minutes`);
            console.log(`  Tokens used: ${scenarioA_tokens.toLocaleString()} (${((scenarioA_tokens / 300000) * 100).toFixed(1)}% of TPD)`);
            console.log('');

            console.log('--- Scenario B: 100 papers, 50% filtered ---');
            const scenarioB_time = 100 * (avgCA + CONFIG.delayBetweenPapersMs) + 50 * (avgTG + avgSG);
            const scenarioB_tokens = 100 * avgCA_Tokens + 50 * (avgTG_Tokens + avgSG_Tokens);
            console.log(`  Processing time: ${(scenarioB_time / 60000).toFixed(1)} minutes`);
            console.log(`  Tokens used: ${scenarioB_tokens.toLocaleString()} (${((scenarioB_tokens / 300000) * 100).toFixed(1)}% of TPD)`);
            console.log('');

            console.log('--- Scenario C: 100 papers, 80% filtered (typical) ---');
            const scenarioC_time = 100 * (avgCA + CONFIG.delayBetweenPapersMs) + 20 * (avgTG + avgSG);
            const scenarioC_tokens = 100 * avgCA_Tokens + 20 * (avgTG_Tokens + avgSG_Tokens);
            console.log(`  Processing time: ${(scenarioC_time / 60000).toFixed(1)} minutes`);
            console.log(`  Tokens used: ${scenarioC_tokens.toLocaleString()} (${((scenarioC_tokens / 300000) * 100).toFixed(1)}% of TPD)`);
            console.log('');

            console.log('--- Daily Capacity (TPD Limit: 300K tokens) ---');
            const papersBeforeTPD_CAOnly = Math.floor(300000 / avgCA_Tokens);
            const papersBeforeTPD_Full = Math.floor(300000 / tokensPerRelevantPaper);
            console.log(`  Max papers (all filtered): ~${papersBeforeTPD_CAOnly.toLocaleString()} papers`);
            console.log(`  Max papers (none filtered): ~${papersBeforeTPD_Full.toLocaleString()} papers`);
        }

    } catch (error: any) {
        console.error('');
        console.error('ERROR:', error.message);
        console.error(error.stack);
    } finally {
        const totalDuration = Date.now() - startTime;
        console.log('');
        console.log('================================================================================');
        console.log(`Total Test Duration: ${(totalDuration / 60000).toFixed(1)} minutes`);
        console.log('================================================================================');

        await prisma.$disconnect();
    }
}

runSequentialTest();
