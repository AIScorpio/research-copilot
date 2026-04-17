import { logger } from '../logger';
import { BaseProvider } from '../llm-base-provider';
import { LLMConfig } from '../llm-types';
import { DEFAULT_MODELS } from '../llm-types';
import { parseAnthropicStream } from './streaming/anthropic-stream-parser';

export class AnthropicProvider extends BaseProvider {
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

    async chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string> {
        const systemMessage = messages.find(m => m.role === 'system')?.content;
        const nonSystemMessages = messages.filter(m => m.role !== 'system');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS.anthropic,
                system: systemMessage,
                messages: nonSystemMessages,
                max_tokens: this.config.maxTokens || 4096,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`${this.getProviderName()} API error: ${error}`);
        }

        const data = await response.json();
        return data.content?.[0]?.text?.trim() || '';
    }

    async *chatStream(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): AsyncGenerator<{ type: 'token' | 'done' | 'error' | 'thinking'; content: string }, void, unknown> {
        const systemMsg = messages.find(m => m.role === 'system');
        const nonSystem = messages.filter(m => m.role !== 'system');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS.anthropic,
                system: systemMsg?.content,
                messages: nonSystem,
                max_tokens: this.config.maxTokens || 4096,
                stream: true,
            }),
        });
        if (!response.ok) {
            const error = await response.text().catch(() => `HTTP ${response.status}`);
            yield { type: 'error' as const, content: `${this.getProviderName()} API error: ${error}` };
            return;
        }
        yield* parseAnthropicStream(response);
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
