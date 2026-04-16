/**
 * LLM Provider Management API
 * Manages user's LLM provider configurations with multi-provider support
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { handleError, createValidationError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { LLMProviderFactory, reinitializeLLMFromDatabase } from '@/lib/llm-service';
import { promises as fs } from 'fs';
import { join } from 'path';
import { fetchAvailableModels, LLMModelInfo } from '@/lib/llm-model-fetcher';

// Helper function to get API key from environment variables
function getApiKeyFromEnv(providerType: string): string | undefined {
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

// Helper function to get API key environment variable name
function getApiKeyEnvName(providerType: string): string | undefined {
    switch (providerType) {
        case 'groq':
            return 'GROQ_API_KEY';
        case 'openai':
            return 'OPENAI_API_KEY';
        case 'anthropic':
            return 'ANTHROPIC_API_KEY';
        case 'gemini':
            return 'GEMINI_API_KEY';
        case 'azure':
            return 'AZURE_OPENAI_API_KEY';
        case 'cohere':
            return 'COHERE_API_KEY';
        case 'zhipuai':
            return 'ZHIPUAI_API_KEY';
        case 'kimi':
            return 'KIMI_API_KEY';
        case 'baidu':
            return 'BAIDU_API_KEY';
        case 'alibaba':
            return 'ALIBABA_API_KEY';
        default:
            return undefined;
    }
}

// Initialize base providers (run once at startup)
export async function initializeBaseProviders() {
    const providers = [
        { type: 'groq', name: 'Groq', isCloud: true, docsUrl: 'https://console.groq.com/docs' },
        { type: 'openai', name: 'OpenAI', isCloud: true, docsUrl: 'https://platform.openai.com/docs' },
        { type: 'anthropic', name: 'Anthropic', isCloud: true, docsUrl: 'https://docs.anthropic.com' },
        { type: 'gemini', name: 'Google Gemini', isCloud: true, docsUrl: 'https://ai.google.dev/docs' },
        { type: 'azure', name: 'Azure OpenAI', isCloud: true, docsUrl: 'https://learn.microsoft.com/azure/ai-services/openai' },
        { type: 'cohere', name: 'Cohere', isCloud: true, docsUrl: 'https://docs.cohere.com' },
        { type: 'ollama', name: 'Ollama', isCloud: false, baseUrl: 'http://localhost:11434', docsUrl: 'https://ollama.com/docs' },
        { type: 'lmstudio', name: 'LM Studio', isCloud: false, baseUrl: 'http://localhost:1234', docsUrl: 'https://lmstudio.ai/docs' },
        { type: 'zhipuai', name: 'ZhipuAI (智谱AI)', isCloud: true, docsUrl: 'https://www.bigmodel.cn/dev/howuse/introduction' },
        { type: 'kimi', name: 'Kimi (月之暗面)', isCloud: true, docsUrl: 'https://docs.moonshot.cn' },
        { type: 'baidu', name: 'Baidu ERNIE (百度)', isCloud: true, docsUrl: 'https://cloud.baidu.com/doc/WENXINWORKSHOP' },
        { type: 'alibaba', name: 'Alibaba Qwen (通义千问)', isCloud: true, docsUrl: 'https://help.aliyun.com/zh/dashscope' },
    ];

    for (const provider of providers) {
        await prisma.lLMProviderBase.upsert({
            where: { type: provider.type },
            update: {},
            create: provider
        });
    }

    // Initialize base models
    const models = [
        // Groq models
        { providerType: 'groq', externalId: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, capabilities: JSON.stringify(['chat']) },
        { providerType: 'groq', externalId: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', contextWindow: 128000, capabilities: JSON.stringify(['chat']) },
        { providerType: 'groq', externalId: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768, capabilities: JSON.stringify(['chat']) },
        // OpenAI models
        { providerType: 'openai', externalId: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, capabilities: JSON.stringify(['chat', 'vision']) },
        { providerType: 'openai', externalId: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, capabilities: JSON.stringify(['chat', 'vision']) },
        { providerType: 'openai', externalId: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', contextWindow: 16385, capabilities: JSON.stringify(['chat']) },
        // Anthropic models
        { providerType: 'anthropic', externalId: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000, capabilities: JSON.stringify(['chat', 'vision']) },
        { providerType: 'anthropic', externalId: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', contextWindow: 200000, capabilities: JSON.stringify(['chat', 'vision']) },
        // Gemini models
        { providerType: 'gemini', externalId: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, capabilities: JSON.stringify(['chat', 'vision']) },
        { providerType: 'gemini', externalId: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, capabilities: JSON.stringify(['chat', 'vision']) },
        // Ollama models
        { providerType: 'ollama', externalId: 'llama3.2', name: 'Llama 3.2', contextWindow: 128000, capabilities: JSON.stringify(['chat']) },
        { providerType: 'ollama', externalId: 'mistral', name: 'Mistral', contextWindow: 32768, capabilities: JSON.stringify(['chat']) },
        // LM Studio (generic)
        { providerType: 'lmstudio', externalId: 'local-model', name: 'Local Model', contextWindow: 4096, capabilities: JSON.stringify(['chat']) },
        // ZhipuAI models
        { providerType: 'zhipuai', externalId: 'glm-4', name: 'GLM-4', contextWindow: 128000, capabilities: JSON.stringify(['chat', 'vision']) },
        { providerType: 'zhipuai', externalId: 'glm-4v', name: 'GLM-4V', contextWindow: 128000, capabilities: JSON.stringify(['vision']) },
        { providerType: 'zhipuai', externalId: 'glm-3-turbo', name: 'GLM-3 Turbo', contextWindow: 128000, capabilities: JSON.stringify(['chat']) },
        // Kimi models
        { providerType: 'kimi', externalId: 'moonshot-v1-8k', name: 'Moonshot V1 8K', contextWindow: 8192, capabilities: JSON.stringify(['chat']) },
        { providerType: 'kimi', externalId: 'moonshot-v1-32k', name: 'Moonshot V1 32K', contextWindow: 32768, capabilities: JSON.stringify(['chat']) },
        { providerType: 'kimi', externalId: 'moonshot-v1-128k', name: 'Moonshot V1 128K', contextWindow: 131072, capabilities: JSON.stringify(['chat']) },
        // Baidu ERNIE models
        { providerType: 'baidu', externalId: 'ernie-bot-4', name: 'ERNIE Bot 4.0', contextWindow: 32000, capabilities: JSON.stringify(['chat', 'vision']) },
        { providerType: 'baidu', externalId: 'ernie-bot-turbo', name: 'ERNIE Bot Turbo', contextWindow: 32000, capabilities: JSON.stringify(['chat']) },
        // Alibaba Qwen models
        { providerType: 'alibaba', externalId: 'qwen-max', name: 'Qwen Max', contextWindow: 32000, capabilities: JSON.stringify(['chat', 'vision']) },
        { providerType: 'alibaba', externalId: 'qwen-plus', name: 'Qwen Plus', contextWindow: 64000, capabilities: JSON.stringify(['chat']) },
        { providerType: 'alibaba', externalId: 'qwen-turbo', name: 'Qwen Turbo', contextWindow: 32000, capabilities: JSON.stringify(['chat']) },
    ];

    for (const model of models) {
        const provider = await prisma.lLMProviderBase.findUnique({
            where: { type: model.providerType }
        });
        if (provider) {
            await prisma.lLMModelBase.upsert({
                where: {
                    providerId_externalId: {
                        providerId: provider.id,
                        externalId: model.externalId
                    }
                },
                update: {},
                create: {
                    ...model,
                    providerId: provider.id
                }
            });
        }
    }
}

// GET /api/llm-providers - Get user's LLM configurations
export async function GET() {
    try {
        const user = await requireAuth();

        // Initialize base providers if database is empty (first run)
        const providerCount = await prisma.lLMProviderBase.count();
        if (providerCount === 0) {
            await initializeBaseProviders();
        }

        const configs = await prisma.userLLMConfig.findMany({
            where: {
                userId: user.id,
                deletedAt: null
            },
            include: {
                provider: true,
                userModels: {
                    include: {
                        model: true
                    }
                }
            },
            orderBy: {
                priority: 'asc'
            }
        });

        // Get available base providers
        const baseProviders = await prisma.lLMProviderBase.findMany({
            include: {
                models: {
                    where: { isActive: true }
                }
            }
        });

        return NextResponse.json({
            success: true,
            configs: configs.map(config => ({
                id: config.id,
                name: config.name,
                baseUrl: config.baseUrl || undefined,
                provider: config.provider,
                status: config.status,
                priority: config.priority,
                isEnabled: config.isEnabled,
                models: config.userModels.map(um => ({
                    userModelId: um.id,
                    ...um.model,
                    isDefault: um.isDefault,
                    temperature: um.temperature,
                    maxTokens: um.maxTokens
                }))
            })),
            availableProviders: baseProviders
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}

// POST /api/llm-providers - Create new provider configuration
export async function POST(request: Request) {
    try {
        const user = await requireAuth();
        const body = await request.json();

        const { providerId, name, apiKey, baseUrl } = body;

        // Validate required fields
        if (!providerId || !name) {
            return NextResponse.json({
                success: false,
                error: 'Validation Error',
                message: 'Provider and name are required'
            }, { status: 400 });
        }

        // Get provider base info
        const providerBase = await prisma.lLMProviderBase.findUnique({
            where: { id: providerId }
        });

        if (!providerBase) {
            return NextResponse.json({
                success: false,
                error: 'Not Found',
                message: 'Provider not found'
            }, { status: 404 });
        }

        // Check if name already exists for this user
        const existing = await prisma.userLLMConfig.findFirst({
            where: {
                userId: user.id,
                name,
                deletedAt: null
            }
        });

        if (existing) {
            return NextResponse.json({
                success: false,
                error: 'Conflict',
                message: 'A configuration with this name already exists'
            }, { status: 409 });
        }

        // Save API key to .env file if provided
        if (apiKey && providerBase.isCloud) {
            try {
                const envPath = join(process.cwd(), '.env');
                let envContent = '';
                
                try {
                    envContent = await fs.readFile(envPath, 'utf-8');
                } catch {
                    // File doesn't exist
                }
                
                const apiKeyName = getApiKeyEnvName(providerBase.type);
                if (apiKeyName) {
                    // Update or add API key in .env
                    const lines = envContent.split('\n');
                    let updated = false;
                    const newLines = lines.map(line => {
                        if (line.startsWith(`${apiKeyName}=`)) {
                            updated = true;
                            return `${apiKeyName}=${apiKey}`;
                        }
                        return line;
                    });
                    
                    if (!updated) {
                        newLines.push(`${apiKeyName}=${apiKey}`);
                    }
                    
                    await fs.writeFile(envPath, newLines.join('\n'));
                    logger.info(`API Key saved to .env for ${providerBase.type}`);
                    
                    // Update process.env immediately
                    process.env[apiKeyName] = apiKey;
                }
            } catch (error) {
                logger.error('Failed to save API key to .env', { error });
                // Continue even if .env save fails
            }
        }

        // Create configuration
        const config = await prisma.userLLMConfig.create({
            data: {
                userId: user.id,
                providerId,
                name,
                apiKey: null, // Never store API key in database
                baseUrl: baseUrl || providerBase.baseUrl,
                status: 'untested',
                priority: await getNextPriority(user.id),
                isEnabled: false
            },
            include: {
                provider: true
            }
        });

        logger.info('LLM provider config created', { userId: user.id, configId: config.id });

        return NextResponse.json({
            success: true,
            config: {
                id: config.id,
                name: config.name,
                provider: config.provider,
                status: config.status,
                priority: config.priority,
                isEnabled: config.isEnabled
            }
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}

// PATCH /api/llm-providers - Test connection, enable/disable, or select model
export async function PATCH(request: Request) {
    try {
        const user = await requireAuth();
        const { searchParams } = new URL(request.url);
        const configId = searchParams.get('id');
        const action = searchParams.get('action') || 'test';

        if (!configId) {
            return NextResponse.json({
                success: false,
                error: 'Bad Request',
                message: 'Config ID is required'
            }, { status: 400 });
        }

        const config = await prisma.userLLMConfig.findFirst({
            where: {
                id: configId,
                userId: user.id,
                deletedAt: null
            },
            include: {
                provider: true,
                userModels: {
                    include: { model: true }
                }
            }
        });

        if (!config) {
            return NextResponse.json({
                success: false,
                error: 'Not Found',
                message: 'Configuration not found'
            }, { status: 404 });
        }

        // Handle different actions
        switch (action) {
            case 'test': {
                const startTime = Date.now();
                let isConnected = false;
                let errorMessage = '';
                let availableModels: LLMModelInfo[] = [];

                try {
                    const apiKey = getApiKeyFromEnv(config.provider.type);

                    const llmConfig = {
                        provider: config.provider.type as any,
                        apiKey: apiKey,
                        baseUrl: config.baseUrl || undefined,
                        model: undefined
                    };

                    const provider = LLMProviderFactory.create(llmConfig);
                    isConnected = await provider.testConnection();

                    if (isConnected) {
                        // Build config for shared fetchAvailableModels
                        // Note: providerId must be LLMProviderBase.id (not UserLLMConfig.id) for FK constraint
                        const fetchConfig: import('@/lib/llm-model-fetcher').FetchModelsConfig =
                            config.provider.type === 'ollama'
                                ? { baseUrl: config.baseUrl || undefined, providerId: config.providerId }
                                : { providerId: config.providerId };
                        availableModels = await fetchAvailableModels(config.provider.type, fetchConfig);
                    }
                } catch (error) {
                    isConnected = false;
                    errorMessage = (error as Error).message;
                }

                const latency = Date.now() - startTime;

                await prisma.userLLMConfig.update({
                    where: { id: configId },
                    data: {
                        status: isConnected ? 'connected' : 'failed',
                        errorMessage: isConnected ? null : errorMessage
                    }
                });

                return NextResponse.json({
                    success: true,
                    connected: isConnected,
                    latency: `${latency}ms`,
                    message: isConnected ? 'Connection successful' : errorMessage,
                    availableModels: isConnected ? availableModels.map(m => ({
                        id: m.externalId,
                        name: m.name,
                        externalId: m.externalId
                    })) : []
                });
            }

            case 'enable': {
                const enabled = searchParams.get('enabled') === 'true';
                const updated = await prisma.userLLMConfig.update({
                    where: { id: configId },
                    data: { isEnabled: enabled }
                });

                return NextResponse.json({
                    success: true,
                    isEnabled: updated.isEnabled,
                    message: updated.isEnabled ? 'Provider enabled' : 'Provider disabled'
                });
            }

            case 'selectModel': {
                const encodedModelId = searchParams.get('modelId');
                const modelName = searchParams.get('modelName') || encodedModelId || '';
                const modelContextWindow = parseInt(searchParams.get('contextWindow') || '128000');
                
                if (!encodedModelId) {
                    return NextResponse.json({
                        success: false,
                        error: 'Bad Request',
                        message: 'Model ID is required'
                    }, { status: 400 });
                }

                // Decode the model ID (handle special characters like ':' in Ollama model names)
                const modelExternalId = decodeURIComponent(encodedModelId);

                // Try to find existing model in database
                let modelBase = await prisma.lLMModelBase.findFirst({
                    where: {
                        providerId: config.providerId,
                        externalId: modelExternalId
                    }
                });

                // If not found (e.g., dynamically loaded Ollama models), create it
                if (!modelBase) {
                    logger.info(`Creating new model in database: ${modelExternalId} for provider ${config.providerId}`);
                    
                    modelBase = await prisma.lLMModelBase.create({
                        data: {
                            providerId: config.providerId,
                            externalId: modelExternalId,
                            name: modelName,
                            contextWindow: modelContextWindow,
                            capabilities: JSON.stringify(['chat'])
                        }
                    });
                }

                // Find or create UserLLMModel with isDefault=true
                const existingModel = config.userModels.find(um => um.modelId === modelBase.id);

                if (existingModel) {
                    await prisma.userLLMModel.update({
                        where: { id: existingModel.id },
                        data: { isDefault: true }
                    });
                } else {
                    await prisma.userLLMModel.create({
                        data: {
                            userConfigId: configId,
                            modelId: modelBase.id,
                            isDefault: true
                        }
                    });
                }

                // Unset isDefault for other models of this config
                await prisma.userLLMModel.updateMany({
                    where: {
                        userConfigId: configId,
                        NOT: { modelId: modelBase.id }
                    },
                    data: { isDefault: false }
                });

                // Reinitialize LLM providers to pick up the new model
                await reinitializeLLMFromDatabase('system');

                return NextResponse.json({
                    success: true,
                    message: `Model ${modelBase.name} selected as default`
                });
            }

            default:
                return NextResponse.json({
                    success: false,
                    error: 'Bad Request',
                    message: `Unknown action: ${action}`
                }, { status: 400 });
        }

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}

// DELETE /api/llm-providers/:id - Physical delete configuration
export async function DELETE(request: Request) {
    try {
        const user = await requireAuth();
        const { searchParams } = new URL(request.url);
        const configId = searchParams.get('id');

        if (!configId) {
            return NextResponse.json({
                success: false,
                error: 'Bad Request',
                message: 'Config ID is required'
            }, { status: 400 });
        }

        // Physical delete - remove from database completely
        await prisma.userLLMConfig.deleteMany({
            where: {
                id: configId,
                userId: user.id
            }
        });

        // Reorder priorities
        await reorderPriorities(user.id);

        logger.info('LLM provider config physically deleted', { userId: user.id, configId });

        return NextResponse.json({
            success: true,
            message: 'Configuration deleted successfully'
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}

// Helper functions
async function getNextPriority(userId: string): Promise<number> {
    const maxPriority = await prisma.userLLMConfig.aggregate({
        where: {
            userId,
            deletedAt: null
        },
        _max: {
            priority: true
        }
    });
    return (maxPriority._max.priority || 0) + 1;
}

async function reorderPriorities(userId: string) {
    const configs = await prisma.userLLMConfig.findMany({
        where: {
            userId,
            deletedAt: null
        },
        orderBy: {
            priority: 'asc'
        }
    });

    for (let i = 0; i < configs.length; i++) {
        await prisma.userLLMConfig.update({
            where: { id: configs[i].id },
            data: { priority: i }
        });
    }
}

// Use shared fetchAvailableModels from llm-model-fetcher
// This replaces the local implementation
