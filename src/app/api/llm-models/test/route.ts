import { NextResponse } from 'next/server';
import { handleError } from '@/lib/error-handler';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/db';

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

function loadTestCaseConfig(): TestCaseConfig {
    const configPath = path.join(process.cwd(), 'config', 'llm-test-cases.json');
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
}

async function callLLM(provider: string, model: string, systemPrompt: string, userPrompt: string): Promise<{ success: boolean; error: string | null; duration: number; content?: string }> {
    const startTime = Date.now();
    
    try {
        // Get config for provider-specific settings (e.g., Ollama baseUrl)
        const config = await prisma.userLLMConfig.findFirst({
            where: { 
                provider: { type: provider.toLowerCase() }
            },
            include: { provider: true }
        });

        let apiUrl: string;
        let headers: Record<string, string> = {};
        let body: Record<string, unknown>;

        // Build messages array with system + user prompts
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: userPrompt });

        if (provider.toLowerCase() === 'groq') {
            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) {
                return { success: false, error: 'GROQ_API_KEY not configured', duration: Date.now() - startTime };
            }
            apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
            headers = {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            };
            body = {
                model,
                messages,
                max_tokens: 1000,
                temperature: 0.1
            };
        } else if (provider.toLowerCase() === 'ollama') {
            const baseUrl = config?.provider?.baseUrl || 'http://localhost:11434';
            apiUrl = `${baseUrl}/api/chat`;
            body = {
                model,
                messages,
                stream: false
            };
        } else if (provider.toLowerCase() === 'zhipuai') {
            const apiKey = process.env.ZHIPUAI_API_KEY;
            if (!apiKey) {
                return { success: false, error: 'ZHIPUAI_API_KEY not configured', duration: Date.now() - startTime };
            }
            apiUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
            headers = {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            };
            body = {
                model,
                messages,
                max_tokens: 1000
            };
        } else {
            return { success: false, error: 'Unknown provider', duration: Date.now() - startTime };
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            return { success: false, error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`, duration };
        }

        const data = await response.json();
        
        // Check if response has valid content
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            return { success: false, error: 'No response content', duration };
        }

        return { success: true, error: null, duration, content };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error', duration: Date.now() - startTime };
    }
}

function validateTestResult(testType: string, content: string): { valid: boolean; error: string | null } {
    const config = loadTestCaseConfig();
    const { validation } = config;
    
    switch (testType) {
        case 'query': {
            // Should contain AND or OR operators for Boolean query
            const operators = validation.query.mustContainOperators;
            const regex = new RegExp(`\\b(${operators.join('|')})\\b`, 'i');
            const hasOperators = regex.test(content);
            if (!hasOperators) {
                return { valid: false, error: `Query missing ${operators.join('/')} operators` };
            }
            return { valid: true, error: null };
        }
        case 'assessment': {
            // Should be valid JSON with score fields
            try {
                const requiredFields = validation.assessment.requiredFields;
                let cleanedContent = content.trim();
                
                const tryParseAndValidate = (jsonStr: string): { valid: boolean; error: string | null } => {
                    try {
                        const parsed = JSON.parse(jsonStr);
                        
                        // Check top-level flat format: {technical, business, timeliness, practicality}
                        let hasAllFields = requiredFields.every((field: string) => typeof parsed[field] === 'number');
                        
                        // Check nested dimensionScores format: {dimensionScores: {technical, ...}}
                        if (!hasAllFields && parsed.dimensionScores) {
                            hasAllFields = requiredFields.every((field: string) => typeof parsed.dimensionScores[field] === 'number');
                        }
                        
                        if (hasAllFields) {
                            return { valid: true, error: null };
                        }
                        return { valid: false, error: `Missing required score fields (${requiredFields.join(', ')})` };
                    } catch {
                        return { valid: false, error: 'Parse failed' };
                    }
                };
                
                // Step 1: Strip markdown code blocks if present
                if (cleanedContent.includes('```')) {
                    const codeBlockMatch = cleanedContent.match(/```(?:json)?\s*([\s\S]*?)```/);
                    if (codeBlockMatch) {
                        const result = tryParseAndValidate(codeBlockMatch[1].trim());
                        if (result.valid) return result;
                    }
                    // Remove code blocks for further extraction
                    cleanedContent = cleanedContent.replace(/```(?:json)?\s*[\s\S]*?```/g, '').trim();
                }
                
                // Step 2: Try direct parse
                const directResult = tryParseAndValidate(cleanedContent);
                if (directResult.valid) return directResult;
                
                // Step 3: Extract JSON objects using balanced brace matching
                const extractJSONObjects = (text: string): string[] => {
                    const objects: string[] = [];
                    let depth = 0;
                    let start = -1;
                    
                    for (let i = 0; i < text.length; i++) {
                        if (text[i] === '{') {
                            if (depth === 0) start = i;
                            depth++;
                        } else if (text[i] === '}') {
                            depth--;
                            if (depth === 0 && start !== -1) {
                                objects.push(text.substring(start, i + 1));
                                start = -1;
                            }
                        }
                    }
                    return objects;
                };
                
                const jsonObjects = extractJSONObjects(cleanedContent);
                
                // Try each extracted JSON object
                for (const jsonObj of jsonObjects) {
                    const result = tryParseAndValidate(jsonObj);
                    if (result.valid) return result;
                }
                
                // Step 4: Try to find content after thinking tags (for qwen models)
                const afterThinking = cleanedContent.split(/<\/?(?:think|thinking)>/i).pop()?.trim();
                if (afterThinking && afterThinking !== cleanedContent) {
                    const thinkingObjects = extractJSONObjects(afterThinking);
                    for (const jsonObj of thinkingObjects) {
                        const result = tryParseAndValidate(jsonObj);
                        if (result.valid) return result;
                    }
                }
                
                return { valid: false, error: `No valid assessment JSON found. First 200 chars: ${cleanedContent.substring(0, 200)}` };
            } catch (e) {
                return { valid: false, error: `Validation error: ${(e as Error).message}` };
            }
        }
        case 'tags': {
            // tag-generator.ts expects: GeneratedTag[] = [{name, type?, category}]
            try {
                // Strip markdown code blocks
                let cleanedContent = content.trim();
                if (cleanedContent.startsWith('```')) {
                    cleanedContent = cleanedContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,'').trim();
                }
                
                // Find JSON array
                let jsonContent = cleanedContent;
                if (!cleanedContent.startsWith('[')) {
                    const arrayMatch = cleanedContent.match(/\[[\s\S]*?\]/);
                    if (arrayMatch) {
                        jsonContent = arrayMatch[0];
                    }
                }
                
                const parsed = JSON.parse(jsonContent);
                
                // Must be array with at least one tag having name and category
                if (!Array.isArray(parsed) || parsed.length === 0) {
                    return { valid: false, error: 'Expected array of tags' };
                }
                
                // Check at least one tag has required fields (matches tag-generator.ts validation)
                const hasValidTag = parsed.some((tag: any) => tag.name && tag.category);
                if (!hasValidTag) {
                    return { valid: false, error: 'No valid tags with name and category found' };
                }
                
                return { valid: true, error: null };
            } catch {
                return { valid: false, error: 'Invalid JSON format' };
            }
        }
        case 'summary': {
            // Should have reasonable length (not too short, not too long)
            const trimmed = content.trim();
            const { minLength, maxLength } = validation.summary;
            if (trimmed.length < minLength) {
                return { valid: false, error: `Summary too short (${trimmed.length} chars, min ${minLength})` };
            }
            if (trimmed.length > maxLength) {
                return { valid: false, error: `Summary too long (${trimmed.length} chars, max ${maxLength})` };
            }
            return { valid: true, error: null };
        }
        default:
            return { valid: true, error: null };
    }
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

                    const { systemPrompt, userPrompt } = await loadPrompt(testType);
                    const llmResult = await callLLM(modelInfo.provider, modelInfo.id, systemPrompt, userPrompt);

                    // Validate the response content
                    let passed = llmResult.success;
                    let error = llmResult.error;

                    if (llmResult.success && llmResult.content) {
                        const validation = validateTestResult(testType, llmResult.content);
                        if (!validation.valid) {
                            passed = false;
                            error = validation.error;
                        }
                    }

                    result.tests[testType] = {
                        passed,
                        duration: llmResult.duration,
                        error,
                        content: llmResult.content
                    };

                    // Small delay between tests to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                results.push(result);

                // Send result
                await writer.write(encoder.encode(`data: ${JSON.stringify({
                    type: 'result',
                    result
                })}\n\n`));

                // Delay between models
                await new Promise(resolve => setTimeout(resolve, 3000));
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
