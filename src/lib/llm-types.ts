export type LLMProvider = 'groq' | 'openai' | 'anthropic' | 'ollama' | 'lmstudio' | 'zhipuai' | 'kimi' | 'baidu' | 'alibaba' | 'gemini';

export interface LLMConfig {
    provider: LLMProvider;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
    groq: 'moonshotai/kimi-k2-instruct-0905',
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-haiku-20240307',
    ollama: 'llama3.2',
    lmstudio: 'local-model',
    zhipuai: 'glm-4.7',
    kimi: 'moonshot-v1-32k',
    baidu: 'ernie-bot-4',
    alibaba: 'qwen-max',
    gemini: 'gemini-2.5-flash'
};

export const DEFAULT_BASE_URLS: Partial<Record<LLMProvider, string>> = {
    ollama: 'http://localhost:11434',
    lmstudio: 'http://localhost:1234'
};

export interface LLMProviderInterface {
    generateText(prompt: string, systemPrompt?: string): Promise<string>;
    generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
    chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string>;
    testConnection(): Promise<boolean>;
    getProviderName(): string;
}

export function getDefaultConfig(provider: LLMProvider): Partial<LLMConfig> {
    return {
        provider,
        model: DEFAULT_MODELS[provider],
        baseUrl: DEFAULT_BASE_URLS[provider],
    };
}
