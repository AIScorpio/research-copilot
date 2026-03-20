/**
 * LLM Service - Unified interface for multiple LLM providers
 * Supports: Groq, OpenAI, Anthropic, Ollama, LM Studio
 */

import Groq from 'groq-sdk';
import { logger } from './logger';
import { 
    globalRateLimiter,
    callWithRetry,
    sleep,
    RETRY_CONFIG
} from './rate-limiting';

// LLM Provider Types
export type LLMProvider = 'groq' | 'openai' | 'anthropic' | 'ollama' | 'lmstudio' | 'zhipuai' | 'kimi' | 'baidu' | 'alibaba';

// Configuration interface
export interface LLMConfig {
    provider: LLMProvider;
    apiKey?: string;
    baseUrl?: string; // For local models (Ollama, LM Studio)
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

// Default configurations for each provider
const DEFAULT_MODELS: Record<LLMProvider, string> = {
    groq: 'moonshotai/kimi-k2-instruct-0905',
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-haiku-20240307',
    ollama: 'llama3.2',
    lmstudio: 'local-model',
    zhipuai: 'glm-4.7',
    kimi: 'moonshot-v1-32k',
    baidu: 'ernie-bot-4',
    alibaba: 'qwen-max'
};

const DEFAULT_BASE_URLS: Partial<Record<LLMProvider, string>> = {
    ollama: 'http://localhost:11434',
    lmstudio: 'http://localhost:1234'
};

// Provider factory class
export class LLMProviderFactory {
    static create(config: LLMConfig): LLMProviderInterface {
        switch (config.provider) {
            case 'groq':
                return new GroqProvider(config);
            case 'openai':
                return new OpenAIProvider(config);
            case 'anthropic':
                return new AnthropicProvider(config);
            case 'ollama':
                return new OllamaProvider(config);
            case 'lmstudio':
                return new LMStudioProvider(config);
            case 'zhipuai':
                return new ZhipuAIProvider(config);
            case 'kimi':
                return new KimiProvider(config);
            case 'baidu':
                return new BaiduProvider(config);
            case 'alibaba':
                return new AlibabaProvider(config);
            default:
                throw new Error(`Unknown provider: ${config.provider}`);
        }
    }
}

// Abstract provider interface
export interface LLMProviderInterface {
    generateText(prompt: string, systemPrompt?: string): Promise<string>;
    generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
    testConnection(): Promise<boolean>;
    getProviderName(): string;
}

// Base provider class with common functionality
abstract class BaseProvider implements LLMProviderInterface {
    protected config: LLMConfig;

    constructor(config: LLMConfig) {
        this.config = {
            temperature: 0.1,
            maxTokens: 2000,
            ...config
        };
    }

    abstract generateText(prompt: string, systemPrompt?: string): Promise<string>;
    abstract testConnection(): Promise<boolean>;
    abstract getProviderName(): string;

    async generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
        const text = await this.generateText(prompt, systemPrompt);
        return this.parseJSON<T>(text);
    }

    protected parseJSON<T>(text: string): T {
        try {
            // Try to extract JSON from markdown code blocks first
            const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
            let cleanText = jsonMatch ? jsonMatch[1].trim() : text.trim();
            
            // Try direct parse
            try {
                return JSON.parse(cleanText) as T;
            } catch (e) {
                // Continue to recovery attempts
            }
            
            // Attempt 1: Extract balanced JSON array (handles commentary with brackets)
            const extractBalancedArray = (txt: string): string | null => {
                const startIndex = txt.indexOf('[');
                if (startIndex === -1) return null;
                
                let depth = 0;
                let inString = false;
                let escape = false;
                
                for (let i = startIndex; i < txt.length; i++) {
                    const char = txt[i];
                    
                    if (escape) {
                        escape = false;
                        continue;
                    }
                    
                    if (char === '\\') {
                        escape = true;
                        continue;
                    }
                    
                    if (char === '"') {
                        inString = !inString;
                        continue;
                    }
                    
                    if (!inString) {
                        if (char === '[' || char === '{') {
                            depth++;
                        } else if (char === ']' || char === '}') {
                            depth--;
                            if (depth === 0 && char === ']') {
                                return txt.substring(startIndex, i + 1);
                            }
                        }
                    }
                }
                
                return null;
            };
            
            // Try balanced array extraction first (more robust)
            const balancedArray = extractBalancedArray(cleanText);
            if (balancedArray) {
                try {
                    return JSON.parse(balancedArray) as T;
                } catch (e) {
                    // Continue to legacy attempts
                }
            }
            
            // Attempt 2: Extract balanced JSON object
            const extractBalancedObject = (txt: string): string | null => {
                const startIndex = txt.indexOf('{');
                if (startIndex === -1) return null;
                
                let depth = 0;
                let inString = false;
                let escape = false;
                
                for (let i = startIndex; i < txt.length; i++) {
                    const char = txt[i];
                    
                    if (escape) {
                        escape = false;
                        continue;
                    }
                    
                    if (char === '\\') {
                        escape = true;
                        continue;
                    }
                    
                    if (char === '"') {
                        inString = !inString;
                        continue;
                    }
                    
                    if (!inString) {
                        if (char === '{' || char === '[') {
                            depth++;
                        } else if (char === '}' || char === ']') {
                            depth--;
                            if (depth === 0 && char === '}') {
                                return txt.substring(startIndex, i + 1);
                            }
                        }
                    }
                }
                
                return null;
            };
            
            const balancedObject = extractBalancedObject(cleanText);
            if (balancedObject) {
                try {
                    return JSON.parse(balancedObject) as T;
                } catch (e) {
                    // Continue
                }
            }
            
            // Attempt 3: Legacy regex fallback (for edge cases)
            const arrayMatch = cleanText.match(/\[[\s\S]*\]/);
            const objectMatch = cleanText.match(/\{[\s\S]*\}/);
            
            if (arrayMatch) {
                try {
                    return JSON.parse(arrayMatch[0]) as T;
                } catch (e) {
                    // Continue
                }
            }
            
            if (objectMatch) {
                try {
                    return JSON.parse(objectMatch[0]) as T;
                } catch (e) {
                    // Continue
                }
            }
            
            // Attempt 4: Try to fix truncated JSON array
            if (cleanText.includes('[') && !cleanText.trim().endsWith(']')) {
                // Try closing unclosed brackets
                let fixed = cleanText;
                const openBrackets = (fixed.match(/\[/g) || []).length;
                const closeBrackets = (fixed.match(/\]/g) || []).length;
                const openBraces = (fixed.match(/\{/g) || []).length;
                const closeBraces = (fixed.match(/\}/g) || []).length;
                
                // Close missing brackets/braces
                for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}';
                for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']';
                
                try {
                    return JSON.parse(fixed) as T;
                } catch (e) {
                    // Continue
                }
                
                // Try removing last incomplete element
                const lastComma = fixed.lastIndexOf(',');
                if (lastComma > 0) {
                    fixed = fixed.substring(0, lastComma);
                    for (let i = 0; i < (fixed.match(/\{/g) || []).length - (fixed.match(/\}/g) || []).length; i++) fixed += '}';
                    fixed += ']';
                    try {
                        return JSON.parse(fixed) as T;
                    } catch (e) {
                        // Give up
                    }
                }
            }
            
            logger.error('LLM JSON parse error after all recovery attempts', { error: 'Unparseable', text: text.substring(0, 300) });
            throw new Error('Failed to parse LLM response as JSON');
        } catch (error) {
            logger.error('LLM JSON parse error', { error, text: text.substring(0, 200) });
            throw new Error('Failed to parse LLM response as JSON');
        }
    }
}

// Groq Provider
class GroqProvider extends BaseProvider {
    private client: Groq;

    constructor(config: LLMConfig) {
        super(config);
        if (!config.apiKey) {
            throw new Error('Groq API key is required');
        }
        this.client = new Groq({ apiKey: config.apiKey });
    }

    async generateText(prompt: string, systemPrompt?: string): Promise<string> {
        const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
        
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const completion = await this.client.chat.completions.create({
            messages,
            model: this.config.model || DEFAULT_MODELS.groq,
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
        });

        return completion.choices[0]?.message?.content?.trim() || '';
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.generateText('Hello', 'You are a helpful assistant.');
            return true;
        } catch (error) {
            logger.error('Groq connection test failed', { error });
            return false;
        }
    }

    getProviderName(): string {
        return 'Groq';
    }

    // Static method to fetch available models from Groq API
    static async fetchAvailableModels(apiKey: string): Promise<Array<{
        id: string;
        name: string;
        contextWindow: number;
        ownedBy: string;
        active: boolean;
    }>> {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Groq API error: ${response.status}`);
            }

            const data = await response.json();
            
            return data.data?.map((model: any) => ({
                id: model.id,
                name: GroqProvider.formatModelName(model.id),
                contextWindow: model.context_window || 8192,
                ownedBy: model.owned_by,
                active: model.active
            })) || [];
        } catch (error) {
            logger.error('Failed to fetch Groq models', { error });
            return [];
        }
    }

    private static formatModelName(modelId: string): string {
        const nameMap: Record<string, string> = {
            'llama-3.3-70b-versatile': 'Llama 3.3 70B',
            'llama-3.1-8b-instant': 'Llama 3.1 8B Instant',
            'llama3-8b-8192': 'Llama 3 8B',
            'llama3-70b-8192': 'Llama 3 70B',
            'mixtral-8x7b-32768': 'Mixtral 8x7B',
            'gemma2-9b-it': 'Gemma 2 9B',
        };
        return nameMap[modelId] || modelId;
    }
}

// OpenAI Provider
class OpenAIProvider extends BaseProvider {
    private apiKey: string;

    constructor(config: LLMConfig) {
        super(config);
        if (!config.apiKey) {
            throw new Error('OpenAI API key is required');
        }
        this.apiKey = config.apiKey;
    }

    async generateText(prompt: string, systemPrompt?: string): Promise<string> {
        const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
        
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS.openai,
                messages,
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${error}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content?.trim() || '';
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.generateText('Hello');
            return true;
        } catch (error) {
            logger.error('OpenAI connection test failed', { error });
            return false;
        }
    }

    getProviderName(): string {
        return 'OpenAI';
    }
}

// Anthropic Provider
class AnthropicProvider extends BaseProvider {
    private apiKey: string;

    constructor(config: LLMConfig) {
        super(config);
        if (!config.apiKey) {
            throw new Error('Anthropic API key is required');
        }
        this.apiKey = config.apiKey;
    }

    async generateText(prompt: string, systemPrompt?: string): Promise<string> {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS.anthropic,
                max_tokens: this.config.maxTokens || 1000,
                temperature: this.config.temperature,
                system: systemPrompt,
                messages: [{ role: 'user', content: prompt }],
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Anthropic API error: ${error}`);
        }

        const data = await response.json();
        return data.content[0]?.text?.trim() || '';
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.generateText('Hello');
            return true;
        } catch (error) {
            logger.error('Anthropic connection test failed', { error });
            return false;
        }
    }

    getProviderName(): string {
        return 'Anthropic';
    }
}

// Ollama Provider (Local)
class OllamaProvider extends BaseProvider {
    private baseUrl: string;

    constructor(config: LLMConfig) {
        super(config);
        this.baseUrl = config.baseUrl || DEFAULT_BASE_URLS.ollama!;
    }

    async generateText(prompt: string, systemPrompt?: string): Promise<string> {
        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS.ollama,
                prompt: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
                stream: false,
                options: {
                    temperature: this.config.temperature,
                    num_predict: this.config.maxTokens,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Ollama API error: ${error}`);
        }

        const data = await response.json();
        return data.response?.trim() || '';
    }

    async testConnection(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`, {
                method: 'GET',
            });
            return response.ok;
        } catch (error) {
            logger.error('Ollama connection test failed', { error });
            return false;
        }
    }

    getProviderName(): string {
        return 'Ollama';
    }
}

// LM Studio Provider (Local)
class LMStudioProvider extends BaseProvider {
    private baseUrl: string;

    constructor(config: LLMConfig) {
        super(config);
        this.baseUrl = config.baseUrl || DEFAULT_BASE_URLS.lmstudio!;
    }

    async generateText(prompt: string, systemPrompt?: string): Promise<string> {
        const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
        
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS.lmstudio,
                messages,
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`LM Studio API error: ${error}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content?.trim() || '';
    }

    async testConnection(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/v1/models`, {
                method: 'GET',
            });
            return response.ok;
        } catch (error) {
            logger.error('LM Studio connection test failed', { error });
            return false;
        }
    }

    getProviderName(): string {
        return 'LM Studio';
    }
}

// ZhipuAI (智谱AI) Provider
class ZhipuAIProvider extends BaseProvider {
    private apiKey: string;

    constructor(config: LLMConfig) {
        super(config);
        if (!config.apiKey) {
            throw new Error('ZhipuAI API key is required');
        }
        this.apiKey = config.apiKey;
    }

    async generateText(prompt: string, systemPrompt?: string): Promise<string> {
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
        
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS.zhipuai,
                messages,
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`ZhipuAI API error: ${error}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content?.trim() || '';
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.generateText('Hello');
            return true;
        } catch (error) {
            logger.error('ZhipuAI connection test failed', { error });
            return false;
        }
    }

    getProviderName(): string {
        return 'ZhipuAI (智谱AI)';
    }
}

// Kimi (Moonshot AI) Provider
class KimiProvider extends BaseProvider {
    private apiKey: string;

    constructor(config: LLMConfig) {
        super(config);
        if (!config.apiKey) {
            throw new Error('Kimi API key is required');
        }
        this.apiKey = config.apiKey;
    }

    async generateText(prompt: string, systemPrompt?: string): Promise<string> {
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
        
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS.kimi,
                messages,
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Kimi API error: ${error}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content?.trim() || '';
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.generateText('Hello');
            return true;
        } catch (error) {
            logger.error('Kimi connection test failed', { error });
            return false;
        }
    }

    getProviderName(): string {
        return 'Kimi (月之暗面)';
    }
}

// Baidu ERNIE Provider
class BaiduProvider extends BaseProvider {
    private apiKey: string;

    constructor(config: LLMConfig) {
        super(config);
        if (!config.apiKey) {
            throw new Error('Baidu API key is required');
        }
        this.apiKey = config.apiKey;
    }

    async generateText(prompt: string, systemPrompt?: string): Promise<string> {
        const messages: Array<{ role: 'user'; content: string }> = [];
        messages.push({ role: 'user', content: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt });

        const response = await fetch('https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-bot-4?access_token=' + this.apiKey, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages,
                temperature: this.config.temperature,
                max_output_tokens: this.config.maxTokens,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Baidu API error: ${error}`);
        }

        const data = await response.json();
        if (data.error_code) {
            throw new Error(`Baidu API error: ${data.error_msg}`);
        }
        return data.result?.trim() || '';
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.generateText('Hello');
            return true;
        } catch (error) {
            logger.error('Baidu connection test failed', { error });
            return false;
        }
    }

    getProviderName(): string {
        return 'Baidu ERNIE (百度)';
    }
}

// Alibaba Qwen Provider
class AlibabaProvider extends BaseProvider {
    private apiKey: string;

    constructor(config: LLMConfig) {
        super(config);
        if (!config.apiKey) {
            throw new Error('Alibaba Qwen API key is required');
        }
        this.apiKey = config.apiKey;
    }

    async generateText(prompt: string, systemPrompt?: string): Promise<string> {
        const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
        
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS.alibaba,
                messages,
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Alibaba Qwen API error: ${error}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content?.trim() || '';
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.generateText('Hello');
            return true;
        } catch (error) {
            logger.error('Alibaba Qwen connection test failed', { error });
            return false;
        }
    }

    getProviderName(): string {
        return 'Alibaba Qwen (通义千问)';
    }
}

// Global LLM service instances (support multiple providers for fallback)
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
        // Fallback to environment variables
        const provider = (process.env.LLM_PROVIDER as LLMProvider) || 'groq';
        const config: LLMConfig = {
            provider,
            apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
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

// Helper function to check if LLM is configured
export function isLLMConfigured(): boolean {
    return !!(
        process.env.GROQ_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.LLM_PROVIDER === 'ollama' ||
        process.env.LLM_PROVIDER === 'lmstudio'
    );
}

// Export configuration helpers
export function getDefaultConfig(provider: LLMProvider): Partial<LLMConfig> {
    return {
        provider,
        model: DEFAULT_MODELS[provider],
        baseUrl: DEFAULT_BASE_URLS[provider],
    };
}

export { DEFAULT_MODELS, DEFAULT_BASE_URLS, ZhipuAIProvider, KimiProvider, BaiduProvider, AlibabaProvider };

// Import prisma for database access
import { prisma } from './db';

/**
 * Load LLM configurations from database for a user
 * Combines database config with API keys from environment variables
 */
export async function loadLLMConfigsFromDatabase(userId?: string): Promise<LLMConfig[]> {
    try {
        // If userId provided, load for specific user; otherwise load all enabled configs
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
            // No database configs, use environment variables
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
                maxTokens: config.userModels[0]?.maxTokens ?? 2000  // 使用 2000 作为默认值
            };
        });
    } catch (error) {
        logger.error('Failed to load LLM configs from database', { error, userId });
        // Fallback to environment variables
        return [getConfigFromEnv()];
    }
}

/**
 * Initialize LLM providers from database for a user
 */
export async function initializeLLMFromDatabase(userId: string): Promise<LLMProviderInterface[]> {
    const configs = await loadLLMConfigsFromDatabase(userId);
    return initializeMultipleLLM(configs);
}

function getConfigFromEnv(): LLMConfig {
    const provider = (process.env.LLM_PROVIDER as LLMProvider) || 'groq';
    return {
        provider,
        apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
        baseUrl: process.env.LLM_BASE_URL,
        model: process.env.LLM_MODEL,
        temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.1'),
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '1000', 10)
    };
}

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

/**
 * Call LLM with automatic fallback to next provider on failure
 * This is the recommended way to call LLM with multi-provider support
 */
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
            // Apply rate limiting if enabled and we have prompt text
            if (options?.enableRateLimiting && options?.promptText) {
                // Simple token estimation: ~4 chars per token
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
            
            // Check if it's a rate limit error
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
                    continue; // Retry with same provider
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
            rateLimitRetries = 0; // Reset retry counter for new provider
        }
    }
    
    throw lastError || new Error(`All LLM providers failed for ${operationName}`);
}

/**
 * Generate text with fallback support
 */
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

/**
 * Generate JSON with fallback support
 */
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

// ============================================================================
// Global LLM Initialization and Health Check (Phase 2.5+)
// ============================================================================

let isLLMInitialized = false;
let healthCheckInterval: NodeJS.Timeout | null = null;

/**
 * Ensure LLM providers are initialized
 * Idempotent - safe to call multiple times
 */
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
        // Fallback to environment variables
        getLLMProvider();
        isLLMInitialized = true;
    }
}

/**
 * Reinitialize LLM providers from database
 * Forces reload of configuration (useful after model change)
 */
export async function reinitializeLLMFromDatabase(userId: string = 'system'): Promise<void> {
    try {
        logger.debug('Reinitializing LLM providers from database...');
        // Clear existing providers
        globalLLMProviders = [];
        isLLMInitialized = false;
        // Reload from database
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

/**
 * Check and reconnect failed providers
 */
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

/**
 * Start periodic health check
 * @param intervalMs Check interval in milliseconds (default: 5 minutes)
 */
export function startLLMHealthCheck(intervalMs: number = 5 * 60 * 1000): void {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
    }

    healthCheckInterval = setInterval(async () => {
        await checkAndReconnectProviders();
    }, intervalMs);

    logger.info(`LLM health check scheduled every ${intervalMs / 1000}s`);
}

/**
 * Stop health check
 */
export function stopLLMHealthCheck(): void {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
        logger.info('LLM health check stopped');
    }
}

/**
 * Initialize LLM system on app startup
 * Call this in your app entry point (e.g., layout.tsx or middleware)
 */
export function initializeLLMSystem(userId: string = 'system'): void {
    // Initial setup (async, don't block)
    ensureLLMInitialized(userId).catch(err => {
        logger.error('Failed to initialize LLM system', { error: err });
    });

    // Start health check
    startLLMHealthCheck();
}
