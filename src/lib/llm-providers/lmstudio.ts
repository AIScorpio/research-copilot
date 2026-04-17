import { logger } from '../logger';
import { BaseProvider } from '../llm-base-provider';
import { LLMConfig } from '../llm-types';
import { DEFAULT_MODELS, DEFAULT_BASE_URLS } from '../llm-types';
import { parseOpenAIStream } from './streaming/openai-stream-parser';

export class LMStudioProvider extends BaseProvider {
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

    async chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string> {
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
            throw new Error(`${this.getProviderName()} API error: ${error}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content?.trim() || '';
    }

    async *chatStream(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): AsyncGenerator<{ type: 'token' | 'done' | 'error' | 'thinking'; content: string }, void, unknown> {
        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS.lmstudio,
                messages,
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens,
                stream: true,
            }),
        });
        if (!response.ok) {
            const error = await response.text().catch(() => `HTTP ${response.status}`);
            yield { type: 'error', content: `${this.getProviderName()} API error: ${error}` };
            return;
        }
        yield* parseOpenAIStream(response);
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
