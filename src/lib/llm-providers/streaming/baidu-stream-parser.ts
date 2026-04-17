import type { StreamChunk } from './types';

export async function* parseBaiduStream(
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

                try {
                    const parsed = JSON.parse(data);
                    if (parsed.is_end) {
                        yield { type: 'done', content: '' };
                        return;
                    }
                    const result = parsed.result;
                    if (result) {
                        yield { type: 'token', content: result };
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
