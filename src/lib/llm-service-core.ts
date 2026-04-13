import { logger } from './logger';
import { 
    globalRateLimiter,
    sleep,
    RETRY_CONFIG
} from './rate-limiting';
import { prisma } from './db';
import { LLMProvider, LLMConfig, LLMProviderInterface } from './llm-types';
import { LLMProviderFactory } from './llm-provider-factory';

let globalLLMProviders: LLMProviderInterface[] = [];
let currentProviderIndex = 0;

export function initializeLLM(config: LLMConfig): LLMProviderInterface {
    const provider = LLMProviderFactory.create(config);
    globalLLMProviders = [provider];
    currentProviderIndex = 0;
    return provider;
}

export function initializeMultipleLLM(configs: LLMConfig[]): LLMProviderInterface[] {
    globalLLMProviders = configs.map(config => LLMProviderFactory.create(config));
    currentProviderIndex = 0;
    return globalLLMProviders;
}

export function getLLMProvider(): LLMProviderInterface {
    if (globalLLMProviders.length === 0) {
        const provider = (process.env.LLM_PROVIDER as LLMProvider) || 'groq';
        const config: LLMConfig = {
            provider,
            apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY,
            baseUrl: process.env.LLM_BASE_URL,
            model: process.env.LLM_MODEL,
        };
        return initializeLLM(config);
    }
    return globalLLMProviders[currentProviderIndex];
}

export function getNextLLMProvider(): LLMProviderInterface | null {
    currentProviderIndex++;
    if (currentProviderIndex < globalLLMProviders.length) {
        return globalLLMProviders[currentProviderIndex];
    }
    return null;
}

export function resetLLMProviderIndex(): void {
    currentProviderIndex = 0;
}

export function clearLLMProvider(): void {
    globalLLMProviders = [];
    currentProviderIndex = 0;
}

export function isLLMConfigured(): boolean {
    return !!(
        process.env.GROQ_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.LLM_PROVIDER === 'ollama' ||
        process.env.LLM_PROVIDER === 'lmstudio'
    );
}

export async function loadLLMConfigsFromDatabase(userId?: string): Promise<LLMConfig[]> {
    try {
        const whereClause: any = {
            isEnabled: true,
            status: 'connected',
            deletedAt: null
        };
        
        if (userId && userId !== 'system') {
            whereClause.userId = userId;
        }
        
        const configs = await prisma.userLLMConfig.findMany({
            where: whereClause,
            include: {
                provider: true,
                userModels: {
                    where: { isDefault: true },
                    include: { model: true }
                }
            },
            orderBy: { priority: 'asc' }
        });

        if (configs.length === 0) {
            return [getConfigFromEnv()];
        }

        return configs.map((config: any) => {
            const apiKey = getApiKeyFromEnv(config.provider.type);
            const defaultModel = config.userModels[0]?.model;

            return {
                provider: config.provider.type as LLMProvider,
                apiKey: apiKey || undefined,
                baseUrl: config.baseUrl || config.provider.baseUrl || undefined,
                model: defaultModel?.externalId || undefined,
                temperature: config.userModels[0]?.temperature ?? 0.1,
                maxTokens: config.userModels[0]?.maxTokens ?? 2000
            };
        });
    } catch (error) {
        logger.error('Failed to load LLM configs from database', { error, userId });
        return [getConfigFromEnv()];
    }
}

export async function initializeLLMFromDatabase(userId: string): Promise<LLMProviderInterface[]> {
    const configs = await loadLLMConfigsFromDatabase(userId);
    return initializeMultipleLLM(configs);
}

function getConfigFromEnv(): LLMConfig {
    const provider = (process.env.LLM_PROVIDER as LLMProvider) || 'groq';
    return {
        provider,
        apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY,
        baseUrl: process.env.LLM_BASE_URL,
        model: process.env.LLM_MODEL,
        temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.1'),
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '1000', 10)
    };
}

export function getApiKeyFromEnv(providerType: string): string | undefined {
    switch (providerType) {
        case 'groq':
            return process.env.GROQ_API_KEY;
        case 'openai':
            return process.env.OPENAI_API_KEY;
        case 'anthropic':
            return process.env.ANTHROPIC_API_KEY;
        case 'gemini':
            return process.env.GEMINI_API_KEY;
        case 'azure':
            return process.env.AZURE_OPENAI_API_KEY;
        case 'cohere':
            return process.env.COHERE_API_KEY;
        case 'zhipuai':
            return process.env.ZHIPUAI_API_KEY;
        case 'kimi':
            return process.env.KIMI_API_KEY;
        case 'baidu':
            return process.env.BAIDU_API_KEY;
        case 'alibaba':
            return process.env.ALIBABA_API_KEY;
        default:
            return undefined;
    }
}

export async function callLLMWithFallback<T>(
    operation: (llm: LLMProviderInterface) => Promise<T>,
    operationName: string = 'LLM operation',
    options?: {
        promptText?: string;
        invocationType?: 'contentAssessment' | 'tagGeneration' | 'summaryGeneration' | 'queryOptimization';
        enableRateLimiting?: boolean;
    }
): Promise<T> {
    resetLLMProviderIndex();
    let lastError: Error | null = null;
    let rateLimitRetries = 0;
    
    while (true) {
        const llm = getLLMProvider();
        const providerName = llm.getProviderName();
        const modelName = (llm as any).config?.model || 'default';
        
        try {
            if (options?.enableRateLimiting && options?.promptText) {
                const tokensNeeded = Math.ceil(options.promptText.length / 4) + 500;
                await globalRateLimiter.consume(tokensNeeded);
                
                logger.debug(`[LLM RateLimit] Consumed ${tokensNeeded} tokens for ${operationName}`, {
                    model: modelName
                });
            }
            
            logger.debug(`[LLM] Trying ${operationName} with ${providerName}/${modelName}`);
            const result = await operation(llm);
            logger.debug(`[LLM] ${operationName} succeeded with ${providerName}/${modelName}`);
            return result;
        } catch (error) {
            lastError = error as Error;
            
            const err = error as { status?: number; message?: string };
            const isRateLimit = err?.status === 429 || err?.message?.includes('Rate limit');
            
            if (isRateLimit) {
                rateLimitRetries++;
                
                if (rateLimitRetries <= RETRY_CONFIG.maxRetries) {
                    const delay = Math.min(
                        RETRY_CONFIG.baseDelay * Math.pow(2, rateLimitRetries - 1),
                        RETRY_CONFIG.maxDelay
                    );
                    
                    logger.warn(`[LLM RateLimit] Rate limit hit for ${providerName}/${modelName}, ` +
                        `retry ${rateLimitRetries}/${RETRY_CONFIG.maxRetries}, waiting ${delay}ms`);
                    
                    await sleep(delay);
                    continue;
                }
                
                logger.debug(`[LLM RateLimit] Max retries (${RETRY_CONFIG.maxRetries}) exhausted for ${providerName}/${modelName}, switching to fallback provider`);
            }
            
            logger.warn(`[LLM] ${operationName} failed with ${providerName}/${modelName}: ${lastError.message}`);
            
            const nextProvider = getNextLLMProvider();
            if (!nextProvider) {
                logger.error(`[LLM] All providers failed for ${operationName}`);
                break;
            }
            logger.debug(`[LLM] Falling back to next provider`);
            rateLimitRetries = 0;
        }
    }
    
    throw lastError || new Error(`All LLM providers failed for ${operationName}`);
}

export async function generateTextWithFallback(
    prompt: string,
    systemPrompt?: string,
    invocationType?: 'contentAssessment' | 'tagGeneration' | 'summaryGeneration' | 'queryOptimization'
): Promise<string> {
    return callLLMWithFallback(
        llm => llm.generateText(prompt, systemPrompt),
        'generateText',
        {
            promptText: prompt,
            invocationType,
            enableRateLimiting: true
        }
    );
}

export async function generateJSONWithFallback<T>(
    prompt: string,
    systemPrompt?: string,
    invocationType?: 'contentAssessment' | 'tagGeneration' | 'summaryGeneration' | 'queryOptimization'
): Promise<T> {
    return callLLMWithFallback(
        llm => llm.generateJSON<T>(prompt, systemPrompt),
        'generateJSON',
        {
            promptText: prompt,
            invocationType,
            enableRateLimiting: true
        }
    );
}

let isLLMInitialized = false;
let healthCheckInterval: NodeJS.Timeout | null = null;

export async function ensureLLMInitialized(userId: string = 'system'): Promise<void> {
    if (isLLMInitialized && globalLLMProviders.length > 0) {
        return;
    }

    try {
        logger.debug('Initializing LLM providers from database...');
        await initializeLLMFromDatabase(userId);
        isLLMInitialized = true;
        logger.info(`LLM providers initialized: ${globalLLMProviders.length} providers`, {
            providers: globalLLMProviders.map(p => p.getProviderName()),
            models: globalLLMProviders.map(p => (p as any).config?.model)
        });
    } catch (error) {
        logger.warn('Failed to initialize LLM from database, using fallback', { error });
        getLLMProvider();
        isLLMInitialized = true;
    }
}

export async function reinitializeLLMFromDatabase(userId: string = 'system'): Promise<void> {
    try {
        logger.debug('Reinitializing LLM providers from database...');
        globalLLMProviders = [];
        isLLMInitialized = false;
        await initializeLLMFromDatabase(userId);
        isLLMInitialized = true;
        logger.info(`LLM providers reinitialized: ${globalLLMProviders.length} providers`, {
            providers: globalLLMProviders.map(p => p.getProviderName()),
            models: globalLLMProviders.map(p => (p as any).config?.model)
        });
    } catch (error) {
        logger.warn('Failed to reinitialize LLM from database', { error });
        throw error;
    }
}

export async function checkAndReconnectProviders(): Promise<void> {
    if (globalLLMProviders.length === 0) {
        logger.debug('No providers to check, skipping health check');
        return;
    }

    logger.debug('Running LLM provider health check...');

    for (let i = 0; i < globalLLMProviders.length; i++) {
        const provider = globalLLMProviders[i];
        const providerName = provider.getProviderName();

        try {
            const isConnected = await provider.testConnection();
            if (isConnected) {
                logger.debug(`${providerName} health check passed`);
            } else {
                logger.warn(`${providerName} health check failed`);
            }
        } catch (error) {
            logger.warn(`${providerName} health check error`, { error });
        }
    }
}

export function startLLMHealthCheck(intervalMs: number = 5 * 60 * 1000): void {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
    }

    healthCheckInterval = setInterval(async () => {
        await checkAndReconnectProviders();
    }, intervalMs);

    logger.info(`LLM health check scheduled every ${intervalMs / 1000}s`);
}

export function stopLLMHealthCheck(): void {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
        logger.info('LLM health check stopped');
    }
}

export function initializeLLMSystem(userId: string = 'system'): void {
    ensureLLMInitialized(userId).catch(err => {
        logger.error('Failed to initialize LLM system', { error: err });
    });
    startLLMHealthCheck();
}
