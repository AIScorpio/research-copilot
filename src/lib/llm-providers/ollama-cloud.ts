import { logger } from '../logger';
import { BaseProvider } from '../llm-base-provider';
import { LLMConfig } from '../llm-types';
import { DEFAULT_MODELS } from '../llm-types';
import { parseOllamaStream } from './streaming/ollama-stream-parser';

export class OllamaCloudProvider extends BaseProvider {
    private baseUrl: string;
    private apiKey: string;

    constructor(config: LLMConfig) {
        super(config);
        this.baseUrl = config.baseUrl || 'https://ollama.com';
        this.apiKey = config.apiKey || process.env.OLLAMA_API_KEY || '';
    }

    private getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
        };
    }

    async generateText(prompt: string, systemPrompt?: string): Promise<string> {
        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS['ollama-cloud'],
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
            throw new Error(`Ollama Cloud API error: ${error}`);
        }

        const data = await response.json();
        return data.response?.trim() || '';
    }

    async chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string> {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS['ollama-cloud'],
                messages,
                stream: false,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`${this.getProviderName()} API error: ${error}`);
        }

        const data = await response.json();
        return data.message?.content?.trim() || '';
    }

    async *chatStream(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): AsyncGenerator<{ type: 'token' | 'done' | 'error' | 'thinking'; content: string }, void, unknown> {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: this.config.model || DEFAULT_MODELS['ollama-cloud'],
                messages,
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
                headers: this.getHeaders(),
            });
            return response.ok;
        } catch (error) {
            logger.error('Ollama Cloud connection test failed', { error });
            return false;
        }
    }

    getProviderName(): string {
        return 'Ollama Cloud';
    }
}
