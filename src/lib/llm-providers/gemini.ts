import { logger } from '../logger';
import { BaseProvider } from '../llm-base-provider';
import { LLMConfig } from '../llm-types';
import { DEFAULT_MODELS } from '../llm-types';
import { parseOpenAIStream } from './streaming/openai-stream-parser';

export class GeminiProvider extends BaseProvider {
    private apiKey: string;
    private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';

    constructor(config: LLMConfig) {
        super(config);
        if (!config.apiKey) {
            throw new Error('Gemini API key is required');
        }
        this.apiKey = config.apiKey;
    }

    async generateText(prompt: string, systemPrompt?: string): Promise<string> {
        const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
        
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS.gemini,
                messages,
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini API error: ${error}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content?.trim() || '';
    }

    async chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS.gemini,
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
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS.gemini,
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
            const response = await fetch(`${this.baseUrl}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                },
            });
            return response.ok;
        } catch (error) {
            logger.error('Gemini connection test failed', { error });
            return false;
        }
    }

    getProviderName(): string {
        return 'Google Gemini';
    }
}
