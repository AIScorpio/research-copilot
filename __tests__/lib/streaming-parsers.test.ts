import { parseOpenAIStream } from '@/lib/llm-providers/streaming/openai-stream-parser';
import { parseAnthropicStream } from '@/lib/llm-providers/streaming/anthropic-stream-parser';
import { parseOllamaStream } from '@/lib/llm-providers/streaming/ollama-stream-parser';
import { parseBaiduStream } from '@/lib/llm-providers/streaming/baidu-stream-parser';

function createMockStreamBody(body: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(body);
    let position = 0;
    let readerResolve: ((value: any) => void) | null = null;

    return {
        getReader() {
            return {
                read(): Promise<{ done: boolean; value?: Uint8Array }> {
                    if (position < data.length) {
                        const value = data.slice(position);
                        position = data.length;
                        return Promise.resolve({ done: false, value });
                    }
                    return Promise.resolve({ done: true, value: undefined });
                },
                releaseLock() {},
                cancel() {},
            };
        },
    };
}

function createMockResponse(body: string): Response {
    return {
        body: createMockStreamBody(body),
        ok: true,
    } as unknown as Response;
}

describe('Streaming Parsers', () => {
    describe('parseOpenAIStream', () => {
        it('T1: should yield tokens from normal SSE chunks', async () => {
            const sse = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n';
            const response = createMockResponse(sse);
            const tokens: string[] = [];

            for await (const chunk of parseOpenAIStream(response)) {
                if (chunk.type === 'token') tokens.push(chunk.content);
            }

            expect(tokens).toEqual(['Hello', ' world']);
        });

        it('T2: should yield done on [DONE] sentinel', async () => {
            const sse = 'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n\n';
            const response = createMockResponse(sse);
            const events: Array<{ type: string; content: string }> = [];

            for await (const chunk of parseOpenAIStream(response)) {
                events.push({ type: chunk.type, content: chunk.content });
            }

            expect(events[events.length - 1]).toEqual({ type: 'done', content: '' });
        });

        it('T3: should skip malformed JSON gracefully', async () => {
            const sse = 'data: {"choices":[{"delta":{"content":"OK"}}]}\n\ndata: {broken json}\n\ndata: {"choices":[{"delta":{"content":"!"}}]}\n\ndata: [DONE]\n\n';
            const response = createMockResponse(sse);
            const tokens: string[] = [];

            for await (const chunk of parseOpenAIStream(response)) {
                if (chunk.type === 'token') tokens.push(chunk.content);
            }

            expect(tokens).toEqual(['OK', '!']);
        });

        it('T4: should skip empty data lines', async () => {
            const sse = 'data: \n\ndata: {"choices":[{"delta":{"content":"test"}}]}\n\ndata: [DONE]\n\n';
            const response = createMockResponse(sse);
            const tokens: string[] = [];

            for await (const chunk of parseOpenAIStream(response)) {
                if (chunk.type === 'token') tokens.push(chunk.content);
            }

            expect(tokens).toEqual(['test']);
        });
    });

    describe('parseAnthropicStream', () => {
        it('T7: should yield tokens from content_block_delta events', async () => {
            const sse = 'event: content_block_delta\ndata: {"delta":{"text":"Hello"}}\n\nevent: content_block_delta\ndata: {"delta":{"text":" world"}}\n\nevent: message_stop\ndata: {}\n\n';
            const response = createMockResponse(sse);
            const tokens: string[] = [];

            for await (const chunk of parseAnthropicStream(response)) {
                if (chunk.type === 'token') tokens.push(chunk.content);
            }

            expect(tokens).toEqual(['Hello', ' world']);
        });

        it('should yield done on message_stop event', async () => {
            const sse = 'event: message_stop\ndata: {}\n\n';
            const response = createMockResponse(sse);
            const events: Array<{ type: string }> = [];

            for await (const chunk of parseAnthropicStream(response)) {
                events.push({ type: chunk.type });
            }

            expect(events[events.length - 1]).toEqual({ type: 'done' });
        });
    });

    describe('parseOllamaStream', () => {
        it('T5: should yield tokens from NDJSON', async () => {
            const ndjson = '{"response":"Hello","done":false}\n{"response":" world","done":false}\n{"response":"","done":true}\n';
            const response = createMockResponse(ndjson);
            const tokens: string[] = [];

            for await (const chunk of parseOllamaStream(response)) {
                if (chunk.type === 'token') tokens.push(chunk.content);
            }

            expect(tokens).toEqual(['Hello', ' world']);
        });

        it('T6: should yield done on done:true', async () => {
            const ndjson = '{"response":"Hi","done":false}\n{"response":"","done":true}\n';
            const response = createMockResponse(ndjson);
            const events: Array<{ type: string }> = [];

            for await (const chunk of parseOllamaStream(response)) {
                events.push({ type: chunk.type });
            }

            expect(events[events.length - 1]).toEqual({ type: 'done' });
        });
    });

    describe('parseBaiduStream', () => {
        it('T21: should yield tokens from Baidu SSE', async () => {
            const sse = 'data: {"result":"Hello","is_end":false}\n\ndata: {"result":" world","is_end":false}\n\ndata: {"result":"","is_end":true}\n\n';
            const response = createMockResponse(sse);
            const tokens: string[] = [];

            for await (const chunk of parseBaiduStream(response)) {
                if (chunk.type === 'token') tokens.push(chunk.content);
            }

            expect(tokens).toEqual(['Hello', ' world']);
        });

        it('should yield done on is_end:true', async () => {
            const sse = 'data: {"result":"Hi","is_end":false}\n\ndata: {"result":"","is_end":true}\n\n';
            const response = createMockResponse(sse);
            const events: Array<{ type: string }> = [];

            for await (const chunk of parseBaiduStream(response)) {
                events.push({ type: chunk.type });
            }

            expect(events[events.length - 1]).toEqual({ type: 'done' });
        });
    });
});
