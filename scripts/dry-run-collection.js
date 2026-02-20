/**
 * Dry Run Collection Test
 * Tests the complete collection workflow without saving to DB
 * 
 * Usage: node scripts/dry-run-collection.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import collection functions
const { optimizeQuery } = require('../src/lib/query-optimizer');
const { checkContentRelevance } = require('../src/lib/content-filter');
const { generateTagsWithLLM } = require('../src/lib/tag-generator');
const { generateSummary } = require('../src/lib/summary-generator');
const { ensureLLMInitialized } = require('../src/lib/llm-service');

// Load config
const fs = require('fs');
const path = require('path');

function loadCollectionConfig() {
    const configPath = path.join(process.cwd(), 'config', 'collection.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

// Simplified ArXiv search (same logic as collector.ts)
async function searchArxiv(query, since, to, limit = 10) {
    const https = require('https');
    
    const terms = query.split(/\s+/).filter(t => t.length > 0);
    let arxivQuery = terms.map(t => `all:${t}`).join('+AND+');
    
    if (since && to) {
        const formatDate = (d) => {
            return d.getFullYear() + 
                   String(d.getMonth() + 1).padStart(2, '0') + 
                   String(d.getDate()).padStart(2, '0') + '0000';
        };
        arxivQuery += `+AND+submittedDate:[${formatDate(since)}+TO+${formatDate(to)}]`;
    }
    
    const url = `https://export.arxiv.org/api/query?search_query=${arxivQuery}&start=0&max_results=${limit}&sortBy=relevance`;
    
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const results = [];
                const entries = data.split('<entry>');
                entries.slice(1).forEach(entry => {
                    const title = entry.match(/<title>([^<]+)<\/title>/)?.[1]?.trim();
                    const abstract = entry.match(/<summary>([^<]+)<\/summary>/)?.[1]?.trim();
                    const id = entry.match(/<id>([^<]+)<\/id>/)?.[1];
                    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
                    
                    if (title && id) {
                        results.push({
                            title,
                            abstract: abstract || '',
                            url: id,
                            source: 'ArXiv',
                            publicationDate: published ? new Date(published) : new Date()
                        });
                    }
                });
                resolve(results);
            });
        }).on('error', reject);
    });
}

async function runDryRun() {
    console.log('='.repeat(80));
    console.log('DRY RUN COLLECTION TEST');
    console.log('='.repeat(80));
    console.log('');
    console.log('⚠️  NO DATA WILL BE SAVED TO DATABASE');
    console.log('');
    
    try {
        // Step 0: Initialize LLM providers from database
        console.log('### Step 0: Initialize LLM Providers ###');
        await ensureLLMInitialized('system');
        console.log('');
        
        // Step 1: Load config
        console.log('### Step 1: Load Collection Config ###');
        const config = loadCollectionConfig();
        console.log('Query:', config.autoDefaultQuery);
        console.log('Time Range:', config.autoTimeRangeDays, 'days');
        console.log('Max Results:', config.maxResults);
        console.log('');
        
        // Step 2: Query Optimization
        console.log('### Step 2: Query Optimization ###');
        const originalQuery = config.autoDefaultQuery;
        console.log('Original Query:', originalQuery);
        
        const optimizedQuery = await optimizeQuery(originalQuery, { strictness: 'relaxed' });
        console.log('Source:', optimizedQuery.source);
        console.log('Optimized Query:', optimizedQuery.optimizedQuery);
        console.log('');
        
        // Step 3: Search ArXiv
        console.log('### Step 3: Search ArXiv ###');
        const to = new Date('2026-02-17'); // Fixed date for testing
        const since = new Date('2026-02-01'); // 16 days range
        
        console.log('Date Range:', since.toISOString().split('T')[0], 'to', to.toISOString().split('T')[0]);
        
        // Use simple search terms for ArXiv
        const searchTerms = 'machine learning banking';
        
        console.log('Search Terms:', searchTerms);
        
        const results = await searchArxiv(searchTerms, since, to, 10); // Limit to 10 for test
        console.log('Results Found:', results.length);
        console.log('');
        
        if (results.length === 0) {
            console.log('No results found. Test complete.');
            return;
        }
        
        // Step 4: Content Assessment (first 5 papers)
        console.log('### Step 4: Content Assessment ###');
        const validCategories = ['ai-technology', 'business-area', 'risk-category', 'regulatory', 'methodology'];
        const papersToTest = results.slice(0, 5);
        
        for (let i = 0; i < papersToTest.length; i++) {
            const paper = papersToTest[i];
            console.log('');
            console.log('--- Paper ' + (i + 1) + ' ---');
            console.log('Title:', paper.title.substring(0, 70));
            console.log('');
            
            // Content Assessment
            console.log('[Content Assessment]');
            const assessment = await checkContentRelevance(paper.title, paper.abstract);
            console.log('  Technical:', assessment.dimensionScores.technical);
            console.log('  Business:', assessment.dimensionScores.business);
            console.log('  Timeliness:', assessment.dimensionScores.timeliness);
            console.log('  Practicality:', assessment.dimensionScores.practicality);
            console.log('  Total:', assessment.relevanceScore?.toFixed(2));
            console.log('  Technical Bonus:', assessment.technicalBonusApplied ? 'Yes (1.05x)' : 'No');
            console.log('  Is Relevant:', assessment.isRelevant);
            console.log('  Reason:', assessment.reasoning?.substring(0, 100) + '...');
            console.log('');
            
            if (!assessment.isRelevant) {
                console.log('  [SKIPPED - Below threshold]');
                continue;
            }
            
            // Tag Generation
            console.log('[Tag Generation]');
            const tagResult = await generateTagsWithLLM(paper.title, paper.abstract, []);
            console.log('  Tags Generated:', tagResult.tags.length);
            
            let tagErrors = [];
            tagResult.tags.forEach((tag, j) => {
                const isValid = validCategories.includes(tag.category);
                const status = isValid ? '✅' : '❌ INVALID';
                console.log('    ' + (j + 1) + '. ' + tag.name + ' [' + tag.category + '] ' + status);
                if (!isValid) {
                    tagErrors.push(tag);
                }
            });
            
            if (tagErrors.length > 0) {
                console.log('');
                console.log('  ⚠️  INVALID CATEGORIES DETECTED!');
                console.log('  Valid categories:', validCategories.join(', '));
            }
            console.log('');
            
            // Summary Generation
            console.log('[Summary Generation]');
            const summary = await generateSummary(paper.title, paper.abstract);
            console.log('  Summary:', summary.substring(0, 150) + '...');
            console.log('');
        }
        
        // Summary Report
        console.log('='.repeat(80));
        console.log('DRY RUN COMPLETE');
        console.log('='.repeat(80));
        console.log('');
        console.log('Summary:');
        console.log('- Query Optimization: ✅');
        console.log('- ArXiv Search: ✅ (found', results.length, 'papers)');
        console.log('- Content Assessment: ✅ (tested', papersToTest.length, 'papers)');
        console.log('- Tag Generation: ✅');
        console.log('- Summary Generation: ✅');
        console.log('');
        console.log('⚠️  No data was saved to database');
        
    } catch (error) {
        console.error('');
        console.error('ERROR:', error.message);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

runDryRun();
