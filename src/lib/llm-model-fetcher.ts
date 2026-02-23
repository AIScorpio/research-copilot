import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';

export interface LLMModelInfo {
    externalId: string;
    name: string;
    contextWindow: number;
    capabilities: string[];
}

export interface FetchModelsConfig {
    baseUrl?: string;        // For Ollama (from DB)
    providerId?: string;     // For DB caching
}

/**
 * Fetch available models from Groq API
 *
 * API Keys: process.env.GROQ_API_KEY (ONLY from .env, never from DB)
 * Endpoint: https://api.groq.com/openai/v1/models
 * Auth: Bearer token in Authorization header
 * Response: OpenAI-compatible format
 */
export async function fetchGroqModels(config?: FetchModelsConfig): Promise<LLMModelInfo[]> {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        logger.warn('[ModelFetcher] GROQ_API_KEY not configured');
        return [];
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            logger.error('[ModelFetcher] Groq API error', { status: response.status });
            return [];
        }

        const data = await response.json();
        const models: LLMModelInfo[] = (data.data || [])
            .filter((m: any) => m.active !== false)
            .map((m: any) => ({
                externalId: m.id,
                name: m.id,
                contextWindow: m.context_window || 8192,
                capabilities: ['chat']
            }));

        logger.info(`[ModelFetcher] Fetched ${models.length} Groq models`);

        // Update DB cache if providerId provided
        if (config?.providerId) {
            await updateModelsInDB(config.providerId, models);
        }

        return models;
    } catch (error) {
        logger.error('[ModelFetcher] Failed to fetch Groq models', { error });
        return [];
    }
}

/**
 * Fetch available models from ZhipuAI API
 *
 * API Keys: process.env.ZHIPUAI_API_KEY (ONLY from .env, never from DB)
 * Endpoint: https://open.bigmodel.cn/api/paas/v4/models
 * Auth: Bearer token in Authorization header
 * Response: OpenAI-compatible format
 *
 * IMPORTANT: Never hardcode model list - ZhipuAI releases new models frequently
 */
export async function fetchZhipuModels(config?: FetchModelsConfig): Promise<LLMModelInfo[]> {
    const apiKey = process.env.ZHIPUAI_API_KEY;

    if (!apiKey) {
        logger.warn('[ModelFetcher] ZHIPUAI_API_KEY not configured');
        return [];
    }

    try {
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!response.ok) {
            logger.error('[ModelFetcher] ZhipuAI API error', { status: response.status });
            return [];
        }

        const data = await response.json();
        const models: LLMModelInfo[] = (data.data || []).map((m: any) => ({
            externalId: m.id,
            name: m.id,
            contextWindow: 128000,
            capabilities: ['chat']
        }));

        logger.info(`[ModelFetcher] Fetched ${models.length} ZhipuAI models`);

        if (config?.providerId) {
            await updateModelsInDB(config.providerId, models);
        }

        return models;
    } catch (error) {
        logger.error('[ModelFetcher] Failed to fetch ZhipuAI models', { error });
        return [];
    }
}

/**
 * Fetch available models from Ollama instance
 *
 * API Keys: None (local instance)
 * Endpoint: {baseUrl}/api/tags (baseUrl from DB, default: http://localhost:11434)
 * Auth: None required
 * Response: Ollama-specific format { models: [{ name, ... }] }
 */
export async function fetchOllamaModels(config: FetchModelsConfig): Promise<LLMModelInfo[]> {
    const baseUrl = config.baseUrl || 'http://localhost:11434';

    try {
        const response = await fetch(`${baseUrl}/api/tags`);

        if (!response.ok) {
            logger.error('[ModelFetcher] Ollama API error', { status: response.status });
            return [];
        }

        const data = await response.json();
        const models: LLMModelInfo[] = (data.models || []).map((m: any) => ({
            externalId: m.name,
            name: m.name,
            contextWindow: 4096, // Default, varies by model
            capabilities: ['chat']
        }));

        logger.info(`[ModelFetcher] Fetched ${models.length} Ollama models`);

        return models;
    } catch (error) {
        logger.error('[ModelFetcher] Failed to fetch Ollama models', { error });
        return [];
    }
}

/**
 * Main entry point - fetch models for a specific provider type
 *
 * @param providerType - Provider identifier (groq, zhipuai, ollama)
 * @param config - Optional configuration (baseUrl for Ollama, providerId for caching)
 * @returns Array of LLMModelInfo objects
 */
export async function fetchAvailableModels(
    providerType: string,
    config?: FetchModelsConfig
): Promise<LLMModelInfo[]> {
    switch (providerType.toLowerCase()) {
        case 'groq':
            return fetchGroqModels(config);
        case 'zhipuai':
            return fetchZhipuModels(config);
        case 'ollama':
            return fetchOllamaModels(config || {});
        default:
            logger.warn(`[ModelFetcher] Unknown provider type: ${providerType}`);
            return [];
    }
}

/**
 * Update models in database cache
 * Used to keep LLMModelBase table in sync with provider APIs
 */
async function updateModelsInDB(providerId: string, models: LLMModelInfo[]): Promise<void> {
    for (const model of models) {
        const existing = await prisma.lLMModelBase.findFirst({
            where: { providerId, externalId: model.externalId }
        });

        if (existing) {
            await prisma.lLMModelBase.update({
                where: { id: existing.id },
                data: {
                    name: model.name,
                    contextWindow: model.contextWindow,
                    capabilities: JSON.stringify(model.capabilities),
                    isActive: true
                }
            });
        } else {
            await prisma.lLMModelBase.create({
                data: {
                    providerId,
                    externalId: model.externalId,
                    name: model.name,
                    contextWindow: model.contextWindow,
                    capabilities: JSON.stringify(model.capabilities),
                    isActive: true
                }
            });
        }
    }
}
