/**
 * LLM Model Compatibility Test API
 *
 * Tests LLM models using the SAME invocation approach as collection pipeline:
 * - Uses llm-service.ts provider classes (not llm-provider-client.ts)
 * - Uses provider.generateText() for query and summary
 * - Uses provider.generateJSON() for assessment and tags
 * - JSON parsing happens INSIDE provider (throws on failure - same as collection)
 *
 * This ensures models that pass the test will work during actual collection.
 */

import { NextResponse } from 'next/server';
import { handleError } from '@/lib/error-handler';
import fs from 'fs';
import path from 'path';
import { LLMProviderFactory, LLMProvider, LLMConfig } from '@/lib/llm-service';

interface TestRequest {
    models: { id: string; provider: string }[];
}

interface TestResult {
    model: string;
    provider: string;
    tests: {
        query?: { passed: boolean; duration: number; error: string | null; content?: string };
        assessment?: { passed: boolean; duration: number; error: string | null; content?: string };
        tags?: { passed: boolean; duration: number; error: string | null; content?: string };
        summary?: { passed: boolean; duration: number; error: string | null; content?: string };
    };
}

interface TestCaseConfig {
    testCase: {
        query: {
            original: string;
            description: string;
        };
        paper: {
            title: string;
            abstract: string;
        };
    };
    validation: {
        query: {
            mustContainOperators: string[];
            description: string;
        };
        assessment: {
            requiredFields: string[];
            fieldTypes: string;
            description: string;
        };
        tags: {
            requiredField: string;
            fieldType: string;
            description: string;
        };
        summary: {
            minLength: number;
            maxLength: number;
            description: string;
        };
    };
}

// Type for content assessment result (matches content-filter.ts)
interface ContentAssessmentResult {
    isRelevant?: boolean;
    confidence?: number;
    reasoning?: string;
    dimensionScores?: {
        technical: number;
        business: number;
        timeliness: number;
        practicality: number;
    };
    // Flat format support
    technical?: number;
    business?: number;
    timeliness?: number;
    practicality?: number;
}

// Type for generated tag (matches tag-generator.ts)
interface GeneratedTag {
    name: string;
    category: string;
}

/**
 * Get API key from environment variables for a provider type
 */
function getApiKeyFromEnv(providerType: string): string | undefined {
    switch (providerType.toLowerCase()) {
        case 'groq':
            return process.env.GROQ_API_KEY;
        case 'openai':
            return process.env.OPENAI_API_KEY;
        case 'anthropic':
            return process.env.ANTHROPIC_API_KEY;
        case 'zhipuai':
            return process.env.ZHIPUAI_API_KEY;
        case 'kimi':
            return process.env.KIMI_API_KEY;
        case 'alibaba':
            return process.env.ALIBABA_API_KEY;
        case 'baidu':
            return process.env.BAIDU_API_KEY;
        case 'ollama':
        case 'lmstudio':
            return undefined; // Local providers don't need API keys
        default:
            return undefined;
    }
}

function loadTestCaseConfig(): TestCaseConfig {
    const configPath = path.join(process.cwd(), 'config', 'llm-test-cases.json');
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
}

/**
 * Validate query optimization result
 * Should contain AND or OR operators for Boolean query
 */
function validateQueryResult(text: string): { valid: boolean; error: string | null } {
    const operators = ['AND', 'OR'];
    const regex = new RegExp(`\\b(${operators.join('|')})\\b`, 'i');
    if (!regex.test(text)) {
        return { valid: false, error: `Query missing ${operators.join('/')} operators` };
    }
    return { valid: true, error: null };
}

/**
 * Validate content assessment result
 * Check if result has required dimension scores
 */
function validateAssessmentResult(result: ContentAssessmentResult): { valid: boolean; error: string | null } {
    // Check flat format (technical, business, etc. at top level)
    let hasAllFields =
        typeof result.technical === 'number' &&
        typeof result.business === 'number' &&
        typeof result.timeliness === 'number' &&
        typeof result.practicality === 'number';

    // Check nested format (dimensionScores.technical, etc.)
    if (!hasAllFields && result.dimensionScores) {
        hasAllFields =
            typeof result.dimensionScores.technical === 'number' &&
            typeof result.dimensionScores.business === 'number' &&
            typeof result.dimensionScores.timeliness === 'number' &&
            typeof result.dimensionScores.practicality === 'number';
    }

    if (!hasAllFields) {
        return { valid: false, error: 'Missing required score fields (technical, business, timeliness, practicality)' };
    }

    return { valid: true, error: null };
}

/**
 * Validate tag generation result
 * Check if array has at least one valid tag with name and category
 */
function validateTagsResult(result: GeneratedTag[]): { valid: boolean; error: string | null } {
    if (!Array.isArray(result)) {
        return { valid: false, error: 'Expected array of tags' };
    }

    if (result.length === 0) {
        return { valid: false, error: 'Tag array is empty' };
    }

    const hasValidTag = result.some(tag => tag.name && tag.category);
    if (!hasValidTag) {
        return { valid: false, error: 'No valid tags with name and category found' };
    }

    return { valid: true, error: null };
}

/**
 * Validate summary result
 * Check if summary has reasonable length
 */
function validateSummaryResult(text: string): { valid: boolean; error: string | null } {
    const trimmed = text.trim();
    const minLength = 100;
    const maxLength = 2000;

    if (trimmed.length < minLength) {
        return { valid: false, error: `Summary too short (${trimmed.length} chars, min ${minLength})` };
    }
    if (trimmed.length > maxLength) {
        return { valid: false, error: `Summary too long (${trimmed.length} chars, max ${maxLength})` };
    }

    return { valid: true, error: null };
}

interface PromptPair {
    systemPrompt: string;
    userPrompt: string;
}

async function loadPrompt(promptType: 'query' | 'assessment' | 'tags' | 'summary'): Promise<PromptPair> {
    const promptsPath = path.join(process.cwd(), 'config', 'prompts.json');
    const promptsContent = fs.readFileSync(promptsPath, 'utf-8');
    const prompts = JSON.parse(promptsContent);

    const testCaseConfig = loadTestCaseConfig();
    const { query, paper } = testCaseConfig.testCase;

    switch (promptType) {
        case 'query':
            // Matches query-optimizer.ts
            return {
                systemPrompt: prompts.queryOptimization || '',
                userPrompt: `Optimize the following query:\n\nOriginal Query: "${query.original}"\n\nStrictness Level: BALANCED`
            };
        case 'assessment':
            // Matches content-filter.ts
            return {
                systemPrompt: prompts.contentAssessment || '',
                userPrompt: `Evaluate the following paper:\n\nTITLE: ${paper.title}\n\nABSTRACT: ${paper.abstract || 'No abstract available'}`
            };
        case 'tags':
            // Matches tag-generator.ts
            return {
                systemPrompt: prompts.tagSuggestion || '',
                userPrompt: `Generate tags for the following paper:\n\nTITLE: ${paper.title}\n\nABSTRACT: ${paper.abstract || 'No abstract available'}`
            };
        case 'summary':
            // Matches summary-generator.ts
            return {
                systemPrompt: prompts.summaryGeneration || '',
                userPrompt: `Generate an accurate technical summary for the following paper.\nOnly include facts, metrics, and applications explicitly stated in the paper.\nDo NOT fabricate numbers or applications not mentioned in the paper.\n\nTITLE: ${paper.title}\n\nABSTRACT: ${paper.abstract || 'No abstract available'}`
            };
    }
}

export async function POST(request: Request) {
    try {
        const body: TestRequest = await request.json();
        const { models } = body;

        if (!models || models.length === 0) {
            return NextResponse.json({ error: 'No models specified' }, { status: 400 });
        }

        const encoder = new TextEncoder();
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();

        (async () => {
            const results: TestResult[] = [];
            const startTime = Date.now();

            for (const modelInfo of models) {
                const result: TestResult = {
                    model: modelInfo.id,
                    provider: modelInfo.provider,
                    tests: {}
                };

                const testTypes: ('query' | 'assessment' | 'tags' | 'summary')[] = ['query', 'assessment', 'tags', 'summary'];

                for (const testType of testTypes) {
                    // Send progress
                    await writer.write(encoder.encode(`data: ${JSON.stringify({
                        type: 'progress',
                        model: modelInfo.id,
                        test: testType
                    })}\n\n`));

                    const testStart = Date.now();
                    let passed = false;
                    let error: string | null = null;
                    let content: string | undefined = undefined;

                    try {
                        // Create provider instance for this specific model
                        // This uses the SAME approach as collection pipeline
                        const providerConfig: LLMConfig = {
                            provider: modelInfo.provider.toLowerCase() as LLMProvider,
                            model: modelInfo.id,
                            apiKey: getApiKeyFromEnv(modelInfo.provider),
                            temperature: 0.1,
                            maxTokens: 2000,
                        };
                        const provider = LLMProviderFactory.create(providerConfig);
                        const { systemPrompt, userPrompt } = await loadPrompt(testType);

                        if (testType === 'query') {
                            // Query optimization - uses generateText (same as collection)
                            const text = await provider.generateText(userPrompt, systemPrompt);
                            const validation = validateQueryResult(text);
                            passed = validation.valid;
                            error = validation.error;
                            content = text;

                        } else if (testType === 'assessment') {
                            // Content assessment - uses generateJSON (same as collection)
                            // This will THROW if JSON parsing fails - same behavior as collection!
                            const assessmentResult = await provider.generateJSON<ContentAssessmentResult>(userPrompt, systemPrompt);
                            const validation = validateAssessmentResult(assessmentResult);
                            passed = validation.valid;
                            error = validation.error;
                            content = JSON.stringify(assessmentResult, null, 2);

                        } else if (testType === 'tags') {
                            // Tag generation - uses generateJSON (same as collection)
                            // This will THROW if JSON parsing fails - same behavior as collection!
                            const tagsResult = await provider.generateJSON<GeneratedTag[]>(userPrompt, systemPrompt);
                            const validation = validateTagsResult(tagsResult);
                            passed = validation.valid;
                            error = validation.error;
                            content = JSON.stringify(tagsResult, null, 2);

                        } else if (testType === 'summary') {
                            // Summary generation - uses generateText (same as collection)
                            const text = await provider.generateText(userPrompt, systemPrompt);
                            const validation = validateSummaryResult(text);
                            passed = validation.valid;
                            error = validation.error;
                            content = text;
                        }

                    } catch (err) {
                        // Catch exceptions from provider (including JSON parse errors)
                        // This is the SAME behavior as collection - if JSON parsing fails, it throws
                        passed = false;
                        error = err instanceof Error ? err.message : String(err);
                    }

                    result.tests[testType] = {
                        passed,
                        duration: Date.now() - testStart,
                        error,
                        content
                    };
                }

                results.push(result);

                // Send result
                await writer.write(encoder.encode(`data: ${JSON.stringify({
                    type: 'result',
                    result
                })}\n\n`));

                // Small delay between models
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Save results to log file
            const logsDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }

            const timestamp = new Date().toISOString();
            const logData = {
                timestamp,
                duration: Date.now() - startTime,
                results
            };

            // Save timestamped log
            const logFileName = `llm-model-test-${timestamp.split('T')[0]}_${timestamp.split('T')[1].split(':').slice(0, 2).join('-')}.log`;
            fs.writeFileSync(path.join(logsDir, logFileName), JSON.stringify(logData, null, 2));

            // Update latest symlink/copy
            fs.writeFileSync(path.join(logsDir, 'llm-model-test-latest.log'), JSON.stringify(logData, null, 2));

            // Send complete
            await writer.write(encoder.encode(`data: ${JSON.stringify({
                type: 'complete',
                timestamp
            })}\n\n`));

            await writer.close();
        })();

        return new NextResponse(stream.readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ error: handled.error }, { status: handled.statusCode });
    }
}
