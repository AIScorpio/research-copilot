import type { StreamChunk } from './types';

export async function* parseAnthropicStream(
    response: Response
): AsyncGenerator<StreamChunk, void, unknown> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventType = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                if (trimmed.startsWith('event: ')) {
                    currentEventType = trimmed.slice(7).trim();
                } else if (trimmed.startsWith('data: ')) {
                    const data = trimmed.slice(6);

                    if (currentEventType === 'message_stop') {
                        yield { type: 'done', content: '' };
                        return;
                    }

                    if (currentEventType === 'content_block_delta') {
                        try {
                            const parsed = JSON.parse(data);
                            const text = parsed.delta?.text;
                            if (text) {
                                yield { type: 'token', content: text };
                            }
                        } catch {
                            // Skip malformed chunks
                        }
                    }
                }
            }
        }
        yield { type: 'done', content: '' };
    } catch (err) {
        yield { type: 'error', content: err instanceof Error ? err.message : 'Stream error' };
    }
}
