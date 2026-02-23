import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { fetchAvailableModels, LLMModelInfo } from '@/lib/llm-model-fetcher';
import fs from 'fs';
import path from 'path';

interface ModelInfo {
    id: string;
    name: string;
    provider: string;
}

interface TestResult {
    model: string;
    provider: string;
    tests: {
        query?: { passed: boolean; duration: number; error: string | null };
        assessment?: { passed: boolean; duration: number; error: string | null };
        tags?: { passed: boolean; duration: number; error: string | null };
        summary?: { passed: boolean; duration: number; error: string | null };
    };
}

function loadLastTestResults(): { timestamp: string; results: TestResult[] } | null {
    try {
        const logPath = path.join(process.cwd(), 'logs', 'llm-model-test-latest.log');
        if (fs.existsSync(logPath)) {
            const content = fs.readFileSync(logPath, 'utf-8');
            return JSON.parse(content);
        }
    } catch (error) {
        console.error('Failed to load last test results:', error);
    }
    return null;
}

export async function GET() {
    try {
        // Current active providers only
        const providerTypes = ['groq', 'ollama', 'zhipuai'] as const;

        // Get Ollama base URL from DB
        let ollamaBaseUrl: string | undefined;
        try {
            const ollamaProvider = await prisma.lLMProviderBase.findFirst({
                where: { type: 'ollama' }
            });
            ollamaBaseUrl = ollamaProvider?.baseUrl || undefined;
        } catch (e) {
            // Ignore if DB lookup fails, will use default
        }

        const modelPromises = providerTypes.map(async (providerType) => {
            let config: import('@/lib/llm-model-fetcher').FetchModelsConfig | undefined = undefined;
            if (providerType === 'ollama' && ollamaBaseUrl) {
                config = { baseUrl: ollamaBaseUrl };
            }
            const models = await fetchAvailableModels(providerType, config);
            return models.map(m => ({
                id: m.externalId,
                name: m.name,
                provider: providerType.charAt(0).toUpperCase() + providerType.slice(1)
            }));
        });

        const modelArrays = await Promise.all(modelPromises);
        const models = modelArrays.flat();

        const lastResults = loadLastTestResults();

        return NextResponse.json({
            models,
            lastRun: lastResults?.timestamp || null,
            results: lastResults?.results || []
        });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ models: [], error: handled.error }, { status: handled.statusCode });
    }
}
