export type StreamChunk = { type: 'token' | 'done' | 'error' | 'thinking'; content: string };
