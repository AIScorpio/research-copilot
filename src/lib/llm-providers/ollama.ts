import { logger } from '../logger';
import { BaseProvider } from '../llm-base-provider';
import { LLMConfig } from '../llm-types';
import { DEFAULT_MODELS, DEFAULT_BASE_URLS } from '../llm-types';
import { parseOllamaStream } from './streaming/ollama-stream-parser';

export class OllamaProvider extends BaseProvider {
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

    async chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string> {
        const prompt = messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n');

        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS.ollama,
                prompt,
                stream: false,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`${this.getProviderName()} API error: ${error}`);
        }

        const data = await response.json();
        return data.response?.trim() || '';
    }

    async *chatStream(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): AsyncGenerator<{ type: 'token' | 'done' | 'error' | 'thinking'; content: string }, void, unknown> {
        const prompt = messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n');

        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS.ollama,
                prompt,
                stream: true,
            }),
        });
        if (!response.ok) {
            const error = await response.text().catch(() => `HTTP ${response.status}`);
            yield { type: 'error' as const, content: `${this.getProviderName()} API error: ${error}` };
            return;
        }
        yield* parseOllamaStream(response);
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
