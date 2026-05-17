import Groq from 'groq-sdk';
import { logger } from '../logger';
import { BaseProvider } from '../llm-base-provider';
import { LLMConfig } from '../llm-types';
import { DEFAULT_MODELS } from '../llm-types';

interface GroqModelResponse {
    data?: Array<{
        id: string;
        context_window?: number;
        owned_by: string;
        active: boolean;
    }>;
}

export class GroqProvider extends BaseProvider {
    private client: Groq;
    private apiKey: string;

    constructor(config: LLMConfig) {
        super(config);
        if (!config.apiKey) {
            throw new Error('Groq API key is required');
        }
        this.apiKey = config.apiKey;
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
            const response = await fetch('https://api.groq.com/openai/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.ok;
        } catch (error) {
            logger.error('Groq connection test failed', { error });
            return false;
        }
    }

    async chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string> {
        const completion = await this.client.chat.completions.create({
            messages,
            model: this.config.model || DEFAULT_MODELS.groq,
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
        });

        return completion.choices[0]?.message?.content?.trim() || '';
    }

    async *chatStream(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): AsyncGenerator<{ type: 'token' | 'done' | 'error' | 'thinking'; content: string }, void, unknown> {
        try {
            const stream = await this.client.chat.completions.create({
                messages,
                model: this.config.model || DEFAULT_MODELS.groq,
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens,
                stream: true,
            });
            for await (const chunk of stream) {
                const content = chunk.choices?.[0]?.delta?.content;
                if (content) yield { type: 'token' as const, content };
            }
            yield { type: 'done' as const, content: '' };
        } catch (err) {
            yield { type: 'error' as const, content: err instanceof Error ? err.message : 'Groq stream error' };
        }
    }

    getProviderName(): string {
        return 'Groq';
    }

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

            const data = await response.json() as GroqModelResponse;
            
            return data.data?.map((model) => ({
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
