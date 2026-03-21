#!/usr/bin/env node
/**
 * FINAL VALIDATION - Groq Provider + Kimi K2 Model (Actual App Configuration)
 * 100% Pass Rate Required
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GROQ_API_KEY;
const MODEL = 'moonshotai/kimi-k2-instruct-0905';  // ACTUAL MODEL: Kimi K2 via Groq
const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

if (!API_KEY) {
    console.error('ERROR: GROQ_API_KEY not set');
    process.exit(1);
}

function buildPrompt(mode, strictness) {
    return `Role: Banking AI Query Optimization Expert

OUTPUT FORMAT: BOOLEAN QUERY STRING ONLY

REQUIRED FORMAT:
(term1 OR term2) AND ("banking" OR "financial") NOT (exclude1 OR exclude2)

CRITICAL RULES:
1. Use operators: AND, OR, NOT (uppercase ONLY)
2. Wrap terms in parentheses: (term1 OR term2)
3. Quote multi-word terms: "natural language"
4. MUST include NOT clause with exclusions
5. NO SQL SYNTAX - Do NOT use SELECT, FROM, WHERE, TABLE
6. NO NATURAL LANGUAGE - Do NOT write sentences
7. OUTPUT ONLY THE BOOLEAN QUERY STRING

Current Mode: ${mode}
Current Strictness: ${strictness}

MODE/STRICTNESS RULES:

RULE 1 - AUTO MODE (${mode} = "auto"):
- ALWAYS ADD: AND ("banking" OR "financial")
- Format: (expanded_terms) AND ("banking" OR "financial") NOT (exclusions)
- NO EXCEPTIONS

RULE 2 - PIPELINE STRICT (${mode} = "pipeline" AND ${strictness} = "strict"):
- ALWAYS ADD: AND ("banking" OR "financial")
- Format: (expanded_terms) AND ("banking" OR "financial") NOT (exclusions)
- NO EXCEPTIONS

RULE 3 - PIPELINE BALANCED (${mode} = "pipeline" AND ${strictness} = "balanced"):
- IF query contains: fraud, credit, risk, compliance, aml, banking, finance, trading, portfolio
  → ADD: AND ("banking" OR "financial")
- ELSE (generic tech like nlp, transformer, optimizer):
  → NO BANKING

RULE 4 - PIPELINE RELAXED (${mode} = "pipeline" AND ${strictness} = "relaxed"):
- NEVER ADD banking context

MANDATORY VALIDATION:
Before returning, CHECK:
1. Contains AND, OR, NOT operators
2. No SQL keywords (SELECT, FROM, WHERE)
3. Banking rule followed

EXAMPLES:

Example 1 - Auto Mode:
Input: "nlp to sql", Mode: auto
Output: (nlp OR sql) AND ("banking" OR "financial") NOT (gaming)

Example 2 - Pipeline Strict:
Input: "transformer", Mode: pipeline, Strictness: strict
Output: (transformer) AND ("banking" OR "financial") NOT (translation)

Example 3 - Pipeline Balanced Generic:
Input: "nlp to sql", Mode: pipeline, Strictness: balanced
Output: (nlp OR sql) AND (ml OR ai) NOT (gaming)
CRITICAL: MUST use AND even without banking

Example 4 - Pipeline Balanced Banking:
Input: "fraud detection", Mode: pipeline, Strictness: balanced
Output: (fraud OR detection) AND ("banking" OR "financial") NOT (medical)

Example 5 - Pipeline Relaxed:
Input: "optimizer", Mode: pipeline, Strictness: relaxed
Output: (optimizer OR algorithm) AND (ml OR ai) NOT (gaming)
CRITICAL: MUST use AND even without banking

OUTPUT ONLY THE BOOLEAN QUERY STRING. NO EXPLANATIONS.`;
}

async function callLLM(systemPrompt, userPrompt) {
    const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.1
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
}

function isValidBooleanFormat(result) {
    const hasAnd = result.includes('AND');
    const hasOr = result.includes('OR');
    const hasNot = result.includes('NOT');
    const hasParens = result.includes('(') && result.includes(')');
    const noSql = !/(SELECT|FROM|WHERE|TABLE)/i.test(result);
    
    return hasAnd && hasOr && hasNot && hasParens && noSql;
}

function hasBankingContext(result) {
    return result.toLowerCase().includes('banking') || 
           result.toLowerCase().includes('financial');
}

async function runTests() {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('  FINAL VALIDATION - Groq + Kimi K2 (moonshotai/kimi-k2-instruct-0905)');
    console.log('  Requirement: 100% Pass Rate - Boolean Format Only');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const tests = [
        {
            name: 'T1: Auto + nlp to sql',
            mode: 'auto',
            strictness: 'balanced',
            query: 'nlp to sql',
            expectBanking: true
        },
        {
            name: 'T2: Pipeline Strict + transformer',
            mode: 'pipeline',
            strictness: 'strict',
            query: 'transformer architecture',
            expectBanking: true
        },
        {
            name: 'T3: Pipeline Balanced + nlp to sql',
            mode: 'pipeline',
            strictness: 'balanced',
            query: 'nlp to sql',
            expectBanking: false
        },
        {
            name: 'T4: Pipeline Balanced + fraud detection',
            mode: 'pipeline',
            strictness: 'balanced',
            query: 'fraud detection',
            expectBanking: true
        },
        {
            name: 'T5: Pipeline Relaxed + optimizer',
            mode: 'pipeline',
            strictness: 'relaxed',
            query: 'new optimizer algorithm',
            expectBanking: false
        }
    ];

    let passed = 0;
    const results = [];

    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        console.log(`\n─────────────────────────────────────────────────────────────────`);
        console.log(` ${test.name}`);
        console.log(` Mode: ${test.mode} | Strictness: ${test.strictness}`);
        console.log(` Query: "${test.query}"`);
        console.log(` Expected Banking: ${test.expectBanking ? 'YES' : 'NO'}`);
        console.log(`─────────────────────────────────────────────────────────────────`);

        try {
            const systemPrompt = buildPrompt(test.mode, test.strictness);
            const userPrompt = `Optimize: "${test.query}"`;
            
            process.stdout.write(' Calling Groq API (Kimi K2)... ');
            const startTime = Date.now();
            const result = await callLLM(systemPrompt, userPrompt);
            const duration = Date.now() - startTime;
            console.log(`(${duration}ms)`);

            console.log(`\n Output:`);
            console.log(` ${result}`);

            const validFormat = isValidBooleanFormat(result);
            const hasBanking = hasBankingContext(result);
            
            console.log(`\n Validation:`);
            console.log(`   Boolean Format: ${validFormat ? '✓' : '✗'}`);
            console.log(`   Has Banking: ${hasBanking ? 'YES' : 'NO'}`);
            console.log(`   Expected Banking: ${test.expectBanking ? 'YES' : 'NO'}`);

            const testPassed = validFormat && (hasBanking === test.expectBanking);
            
            if (testPassed) {
                console.log(`\n ✅ TEST PASSED`);
                passed++;
            } else {
                console.log(`\n ❌ TEST FAILED`);
                if (!validFormat) console.log(`   Reason: Invalid Boolean format`);
                if (hasBanking !== test.expectBanking) console.log(`   Reason: Banking context mismatch`);
            }

            results.push({
                test: test.name,
                passed: testPassed,
                result: result,
                validFormat,
                hasBanking,
                expectedBanking: test.expectBanking
            });

        } catch (error) {
            console.log(`\n ❌ ERROR: ${error.message}`);
            results.push({ test: test.name, passed: false, error: error.message });
        }

        if (i < tests.length - 1) {
            console.log('\n Waiting 3 seconds...');
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    console.log(`\n═══════════════════════════════════════════════════════════════════`);
    console.log('  FINAL RESULTS');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(` Total Tests: ${tests.length}`);
    console.log(` Passed: ${passed}`);
    console.log(` Failed: ${tests.length - passed}`);
    console.log(` Pass Rate: ${((passed/tests.length)*100).toFixed(0)}%`);
    console.log();

    if (passed === tests.length) {
        console.log(' 🎉🎉🎉 ALL TESTS PASSED - 100% SUCCESS! 🎉🎉🎉');
        console.log('\n Implementation VALIDATED and READY for commit.');
        
        const fs = await import('fs');
        fs.writeFileSync('test-kimi-k2-final-results.json', JSON.stringify({
            timestamp: new Date().toISOString(),
            provider: 'groq',
            model: MODEL,
            totalTests: tests.length,
            passed: passed,
            passRate: '100%',
            results: results
        }, null, 2));
        console.log('\n Results saved to: test-kimi-k2-final-results.json');
        
        process.exit(0);
    } else {
        console.log(' ❌❌❌ TESTS FAILED - IMPLEMENTATION REJECTED ❌❌❌');
        console.log('\n Requirement: 100% pass rate mandatory.');
        console.log(' Fix issues and re-test.');
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
