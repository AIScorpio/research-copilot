/**
 * LLM Settings API
 * GET: Get current LLM configuration
 * POST: Save LLM configuration (validate API key first)
 * Test endpoint for each provider
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { promises as fs } from 'fs';
import { join } from 'path';
import { 
    LLMProvider, 
    LLMConfig, 
    LLMProviderFactory,
    DEFAULT_MODELS,
    DEFAULT_BASE_URLS,
    initializeLLM
} from '@/lib/llm-service';
import { handleError, createValidationError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

// Validation schema for LLM configuration
const LLMConfigSchema = z.object({
    provider: z.enum(['groq', 'openai', 'anthropic', 'ollama', 'lmstudio']),
    apiKey: z.string().optional(),
    baseUrl: z.string().url().optional(),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(8000).optional()
});

// Get current configuration from environment
function getCurrentConfig(): LLMConfig {
    const provider = (process.env.LLM_PROVIDER as LLMProvider) || 'groq';
    
    return {
        provider,
        apiKey: getApiKeyForProvider(provider),
        baseUrl: process.env.LLM_BASE_URL || DEFAULT_BASE_URLS[provider],
        model: process.env.LLM_MODEL || DEFAULT_MODELS[provider],
        temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.3'),
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '1000', 10)
    };
}

function getApiKeyForProvider(provider: LLMProvider): string | undefined {
    switch (provider) {
        case 'groq':
            return process.env.GROQ_API_KEY;
        case 'openai':
            return process.env.OPENAI_API_KEY;
        case 'anthropic':
            return process.env.ANTHROPIC_API_KEY;
        default:
            return undefined;
    }
}

// GET /api/settings/llm - Get current configuration
export async function GET() {
    try {
        const config = getCurrentConfig();
        
        // Mask API key for security
        const maskedConfig = {
            ...config,
            apiKey: config.apiKey ? `${config.apiKey.substring(0, 4)}...${config.apiKey.substring(config.apiKey.length - 4)}` : undefined,
            isConfigured: !!config.apiKey || config.provider === 'ollama' || config.provider === 'lmstudio'
        };
        
        return NextResponse.json({
            success: true,
            config: maskedConfig,
            defaults: {
                models: DEFAULT_MODELS,
                baseUrls: DEFAULT_BASE_URLS
            }
        });
        
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}

// POST /api/settings/llm - Save configuration
export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // Validate input
        const validationResult = LLMConfigSchema.safeParse(body);
        if (!validationResult.success) {
            const error = createValidationError('Invalid configuration', { 
                details: validationResult.error.issues 
            });
            const handled = handleError(error);
            return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
        }
        
        const config = validationResult.data;
        
        // Validate API key for cloud providers
        if (['groq', 'openai', 'anthropic'].includes(config.provider)) {
            if (!config.apiKey || config.apiKey.length < 10) {
                return NextResponse.json({
                    success: false,
                    error: 'Validation Error',
                    message: `${config.provider} requires a valid API key`,
                    statusCode: 400
                }, { status: 400 });
            }
        }
        
        // Test connection before saving
        try {
            const provider = LLMProviderFactory.create(config as LLMConfig);
            const isConnected = await provider.testConnection();
            
            if (!isConnected) {
                return NextResponse.json({
                    success: false,
                    error: 'Connection Error',
                    message: `Failed to connect to ${config.provider}. Please check your API key and try again.`,
                    statusCode: 400
                }, { status: 400 });
            }
        } catch (error) {
            logger.error('LLM connection test failed', { error, provider: config.provider });
            return NextResponse.json({
                success: false,
                error: 'Connection Error',
                message: `Connection test failed: ${(error as Error).message}`,
                statusCode: 400
            }, { status: 400 });
        }
        
        // Update in-memory configuration
        initializeLLM(config as LLMConfig);
        
        // Update environment variables
        process.env.LLM_PROVIDER = config.provider;
        if (config.baseUrl) process.env.LLM_BASE_URL = config.baseUrl;
        if (config.model) process.env.LLM_MODEL = config.model;
        if (config.temperature !== undefined) process.env.LLM_TEMPERATURE = config.temperature.toString();
        if (config.maxTokens) process.env.LLM_MAX_TOKENS = config.maxTokens.toString();
        
        // Save API Key to .env file for persistence
        if (config.apiKey) {
            try {
                const envPath = join(process.cwd(), '.env');
                let envContent = '';
                
                try {
                    envContent = await fs.readFile(envPath, 'utf-8');
                } catch {
                    // File doesn't exist, create new
                }
                
                // Determine which API key to update
                let apiKeyName: string;
                switch (config.provider) {
                    case 'groq':
                        apiKeyName = 'GROQ_API_KEY';
                        process.env.GROQ_API_KEY = config.apiKey;
                        break;
                    case 'openai':
                        apiKeyName = 'OPENAI_API_KEY';
                        process.env.OPENAI_API_KEY = config.apiKey;
                        break;
                    case 'anthropic':
                        apiKeyName = 'ANTHROPIC_API_KEY';
                        process.env.ANTHROPIC_API_KEY = config.apiKey;
                        break;
                    default:
                        apiKeyName = '';
                }
                
                if (apiKeyName) {
                    // Update or add API key in .env
                    const lines = envContent.split('\n');
                    let updated = false;
                    const newLines = lines.map(line => {
                        if (line.startsWith(`${apiKeyName}=`)) {
                            updated = true;
                            return `${apiKeyName}=${config.apiKey}`;
                        }
                        return line;
                    });
                    
                    if (!updated) {
                        newLines.push(`${apiKeyName}=${config.apiKey}`);
                    }
                    
                    await fs.writeFile(envPath, newLines.join('\n'));
                    logger.info(`API Key saved to .env for ${config.provider}`);
                }
            } catch (error) {
                logger.error('Failed to save API key to .env', { error });
                // Continue even if .env save fails
            }
        }
        
        logger.info('LLM configuration updated', { provider: config.provider });
        
        return NextResponse.json({
            success: true,
            message: `Successfully configured ${config.provider}`,
            config: {
                provider: config.provider,
                model: config.model || DEFAULT_MODELS[config.provider],
                baseUrl: config.baseUrl || DEFAULT_BASE_URLS[config.provider]
            }
        });
        
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}

// PATCH /api/settings/llm - Test connection without saving
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        
        const validationResult = LLMConfigSchema.safeParse(body);
        if (!validationResult.success) {
            const error = createValidationError('Invalid configuration', { 
                details: validationResult.error.issues 
            });
            const handled = handleError(error);
            return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
        }
        
        const config = validationResult.data;
        
        try {
            const provider = LLMProviderFactory.create(config as LLMConfig);
            const startTime = Date.now();
            const isConnected = await provider.testConnection();
            const latency = Date.now() - startTime;
            
            if (isConnected) {
                return NextResponse.json({
                    success: true,
                    message: `Successfully connected to ${config.provider}`,
                    latency: `${latency}ms`,
                    provider: config.provider,
                    model: config.model || DEFAULT_MODELS[config.provider]
                });
            } else {
                return NextResponse.json({
                    success: false,
                    error: 'Connection Failed',
                    message: `Could not connect to ${config.provider}. Please verify your settings.`,
                    statusCode: 400
                }, { status: 400 });
            }
        } catch (error) {
            return NextResponse.json({
                success: false,
                error: 'Connection Error',
                message: (error as Error).message,
                statusCode: 400
            }, { status: 400 });
        }
        
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}
