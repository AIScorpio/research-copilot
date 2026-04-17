import type { StreamChunk } from './types';

export async function* parseOllamaStream(
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
                if (!trimmed) continue;

                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed.done) {
                        yield { type: 'done', content: '' };
                        return;
                    }
                    if (parsed.response) {
                        yield { type: 'token', content: parsed.response };
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
