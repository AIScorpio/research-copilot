import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface LLMCallOptions {
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
}

export interface LLMCallResult {
    success: boolean;
    content?: string;
    error?: string;
    duration: number;
    tokensUsed?: number;
}

/**
 * Provider configuration template
 *
 * When adding a new provider, follow this pattern:
 * 1. Add configuration to PROVIDER_CONFIGS
 * 2. Specify: apiUrl, envKey (or null for local), bodyFormat, requiresAuth
 * 3. API keys come from process.env ONLY
 */
interface ProviderConfig {
    apiUrl: string;
    envKey: string | null;          // null for local providers like Ollama
    bodyFormat: 'openai' | 'ollama';
    requiresAuth: boolean;
}

/**
 * Provider configurations
 *
 * API Keys: ALL from process.env, NEVER from database
 * Body Formats:
 *   - 'openai': Standard OpenAI-compatible format (Groq, ZhipuAI, most APIs)
 *   - 'ollama': Ollama-specific format (local instance)
 */
const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
    groq: {
        apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
        envKey: 'GROQ_API_KEY',
        bodyFormat: 'openai',
        requiresAuth: true
    },
    zhipuai: {
        apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        envKey: 'ZHIPUAI_API_KEY',
        bodyFormat: 'openai',
        requiresAuth: true
    },
    ollama: {
        apiUrl: '',  // Set dynamically from DB
        envKey: null,
        bodyFormat: 'ollama',
        requiresAuth: false
    }
};

/**
 * Unified LLM invocation
 *
 * Design Principles:
 * 1. API keys ONLY from process.env (never from database)
 * 2. Local providers (Ollama) get baseUrl from database
 * 3. All cloud providers use OpenAI-compatible format
 * 4. Clear error messages for missing configuration
 *
 * @param provider - Provider name (groq, zhipuai, ollama)
 * @param model - Model identifier
 * @param systemPrompt - System prompt (prepended to messages)
 * @param userPrompt - User message content
 * @param options - Optional: maxTokens, temperature, timeout
 */
export async function callLLM(
    provider: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    options: LLMCallOptions = {}
): Promise<LLMCallResult> {
    const startTime = Date.now();
    const { maxTokens = 1000, temperature = 0.1 } = options;

    try {
        const providerLower = provider.toLowerCase();
        const config = PROVIDER_CONFIGS[providerLower];

        if (!config) {
            return {
                success: false,
                error: `Unknown provider: ${provider}. Supported: groq, zhipuai, ollama`,
                duration: Date.now() - startTime
            };
        }

        // Get API key from environment (NEVER from database)
        const apiKey = config.envKey ? process.env[config.envKey] : undefined;

        if (config.requiresAuth && !apiKey) {
            return {
                success: false,
                error: `${config.envKey} not configured in .env`,
                duration: Date.now() - startTime
            };
        }

        // Get Ollama base URL from DB (local provider configuration)
        let apiUrl = config.apiUrl;
        if (providerLower === 'ollama') {
            const providerRecord = await prisma.lLMProviderBase.findFirst({
                where: { type: 'ollama' }
            });
            const baseUrl = providerRecord?.baseUrl || 'http://localhost:11434';
            apiUrl = `${baseUrl}/api/chat`;
        }

        // Build request based on provider format
        const headers: Record<string, string> = {};
        let body: Record<string, unknown>;

        if (config.bodyFormat === 'openai') {
            // OpenAI-compatible format (Groq, ZhipuAI, etc.)
            const messages: Array<{ role: string; content: string }> = [];
            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content: userPrompt });

            headers['Authorization'] = `Bearer ${apiKey}`;
            headers['Content-Type'] = 'application/json';

            body = {
                model,
                messages,
                max_tokens: maxTokens,
                temperature
            };
        } else if (config.bodyFormat === 'ollama') {
            // Ollama-specific format
            const messages: Array<{ role: string; content: string }> = [];
            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content: userPrompt });

            body = {
                model,
                messages,
                stream: false
            };
        } else {
            return {
                success: false,
                error: `Unsupported body format: ${config.bodyFormat}`,
                duration: Date.now() - startTime
            };
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            return {
                success: false,
                error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`,
                duration
            };
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            return {
                success: false,
                error: 'No response content from LLM',
                duration
            };
        }

        return {
            success: true,
            content,
            duration,
            tokensUsed: data.usage?.total_tokens
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: Date.now() - startTime
        };
    }
}
