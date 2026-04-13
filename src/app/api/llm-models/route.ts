import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { fetchAvailableModels, LLMModelInfo, FetchModelsConfig } from '@/lib/llm-model-fetcher';
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
        logger.error('Failed to load last test results:', { error: error instanceof Error ? error.message : String(error) });
    }
    return null;
}

export async function GET() {
    try {
        // Get ENABLED providers from UserLLMConfig (not hardcoded!)
        const enabledConfigs = await prisma.userLLMConfig.findMany({
            where: { isEnabled: true },
            include: {
                provider: {
                    select: { type: true, baseUrl: true, name: true }
                }
            }
        });

        if (enabledConfigs.length === 0) {
            logger.warn('[LLMModels] No enabled providers found in database');
            return NextResponse.json({
                models: [],
                lastRun: null,
                results: []
            });
        }

        // Extract unique provider types from enabled configs
        const providerTypes = Array.from(new Set(
            enabledConfigs.map(c => c.provider.type)
        )) as string[];

        logger.info('[LLMModels] Fetching models for enabled providers', {
            providers: providerTypes,
            configCount: enabledConfigs.length
        });

        // Helper to get base URL for a provider from user's config
        const getBaseUrlForProvider = (providerType: string): string | undefined => {
            const config = enabledConfigs.find(c => c.provider.type === providerType);
            // Prefer user's custom baseUrl, fallback to provider's default
            return config?.baseUrl || config?.provider.baseUrl || undefined;
        };

        // Fetch models for each enabled provider
        const modelPromises = providerTypes.map(async (providerType) => {
            try {
                let config: FetchModelsConfig | undefined = undefined;

                if (providerType === 'ollama' || providerType === 'lmstudio') {
                    const baseUrl = getBaseUrlForProvider(providerType);
                    if (baseUrl) {
                        config = { baseUrl };
                    }
                } else {
                    const providerRecord = await prisma.lLMProviderBase.findFirst({
                        where: { type: providerType }
                    });
                    if (providerRecord) {
                        config = { providerId: providerRecord.id };
                    }
                }

                const models = await fetchAvailableModels(providerType, config as FetchModelsConfig | undefined);

                logger.info(`[LLMModels] Fetched ${models.length} models for ${providerType}`);

                return models.map(m => ({
                    id: m.externalId,
                    name: m.name,
                    provider: providerType.charAt(0).toUpperCase() + providerType.slice(1)
                }));
            } catch (error) {
                // Don't let one provider failure break the entire response
                logger.error(`[LLMModels] Failed to fetch models for ${providerType}`, { error });
                return [];
            }
        });

        const modelArrays = await Promise.all(modelPromises);
        const models = modelArrays.flat();

        logger.info(`[LLMModels] Total models available for testing: ${models.length}`);

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
