import { logger } from '../logger';
import { BaseProvider } from '../llm-base-provider';
import { LLMConfig } from '../llm-types';
import { DEFAULT_MODELS } from '../llm-types';
import { parseBaiduStream } from './streaming/baidu-stream-parser';

export class BaiduProvider extends BaseProvider {
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

    async chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string> {
        const systemMessage = messages.find(m => m.role === 'system')?.content;
        const nonSystemMessages = messages.filter(m => m.role !== 'system');
        const formattedMessages = nonSystemMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        const body: any = {
            messages: formattedMessages,
            temperature: this.config.temperature,
            max_output_tokens: this.config.maxTokens,
        };
        if (systemMessage) {
            (body as any).system = systemMessage;
        }

        const response = await fetch('https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-bot-4?access_token=' + this.apiKey, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`${this.getProviderName()} API error: ${error}`);
        }

        const data = await response.json();
        if (data.error_code) {
            throw new Error(`Baidu API error: ${data.error_msg}`);
        }
        return data.result?.trim() || '';
    }

    async *chatStream(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): AsyncGenerator<{ type: 'token' | 'done' | 'error' | 'thinking'; content: string }, void, unknown> {
        const systemMessage = messages.find(m => m.role === 'system')?.content;
        const nonSystemMessages = messages.filter(m => m.role !== 'system');
        const formattedMessages = nonSystemMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        const body: Record<string, unknown> = {
            messages: formattedMessages,
            temperature: this.config.temperature,
            max_output_tokens: this.config.maxTokens,
            stream: true,
        };
        if (systemMessage) {
            body.system = systemMessage;
        }

        const response = await fetch('https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-bot-4?access_token=' + this.apiKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const error = await response.text().catch(() => `HTTP ${response.status}`);
            yield { type: 'error' as const, content: `${this.getProviderName()} API error: ${error}` };
            return;
        }
        yield* parseBaiduStream(response);
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
