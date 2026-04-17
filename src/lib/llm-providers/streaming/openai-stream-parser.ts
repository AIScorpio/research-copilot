import type { StreamChunk } from './types';

export async function* parseOpenAIStream(
    response: Response
): AsyncGenerator<StreamChunk, void, unknown> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                const data = trimmed.slice(6);

                if (data === '[DONE]') {
                    yield { type: 'done', content: '' };
                    return;
                }

                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta;
                    if (delta?.reasoning_content) {
                        yield { type: 'thinking', content: delta.reasoning_content };
                    }
                    if (delta?.content) {
                        yield { type: 'token', content: delta.content };
                    }
                } catch {
                    // Skip malformed chunks
                }
            }
        }
        yield { type: 'done', content: '' };
    } catch (err) {
        yield { type: 'error', content: err instanceof Error ? err.message : 'Stream error' };
    }
}
