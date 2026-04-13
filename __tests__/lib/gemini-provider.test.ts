import { jest } from '@jest/globals';

jest.mock('groq-sdk', () => ({ default: jest.fn() }));
jest.mock('@/lib/rate-limiting', () => ({
  globalRateLimiter: { consume: jest.fn().mockResolvedValue(undefined) },
  callWithRetry: jest.fn(),
  sleep: jest.fn(),
  RETRY_CONFIG: { maxRetries: 3, baseDelay: 1000, maxDelay: 30000 },
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
    logPaperDetails: jest.fn(), logCollectionSummary: jest.fn(),
    withRunContext: jest.fn((_: string, __: string, fn: () => any) => fn()),
    getRunContext: jest.fn(),
  },
}));
jest.mock('@/lib/db', () => ({
  prisma: {
    userLLMConfig: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

import { LLMProviderFactory, LLMProvider } from '@/lib/llm-service';

describe('GeminiProvider', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('should throw when no API key is provided', () => {
    expect(() => LLMProviderFactory.create({ provider: 'gemini' as LLMProvider }))
      .toThrow('Gemini API key is required');
  });

  it('should create provider with valid config', () => {
    const provider = LLMProviderFactory.create({
      provider: 'gemini' as LLMProvider,
      apiKey: 'test-key',
    });
    expect(provider).toBeDefined();
  });

  it('should call correct endpoint with system prompt', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Hello response' } }],
      }),
    });
    global.fetch = mockFetch;

    const provider = LLMProviderFactory.create({
      provider: 'gemini' as LLMProvider,
      apiKey: 'test-key',
    });

    const result = await provider.generateText('Hello prompt', 'You are a system');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: 'system', content: 'You are a system' },
      { role: 'user', content: 'Hello prompt' },
    ]);
    expect(body.model).toBeDefined();
    expect(body.temperature).toBeDefined();
    expect(body.max_tokens).toBeDefined();
    expect(result).toBe('Hello response');
  });

  it('should not include system message when systemPrompt is omitted', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'No system' } }],
      }),
    });
    global.fetch = mockFetch;

    const provider = LLMProviderFactory.create({
      provider: 'gemini' as LLMProvider,
      apiKey: 'test-key',
    });

    await provider.generateText('Hello prompt');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: 'user', content: 'Hello prompt' },
    ]);
  });

  it('should throw on API error response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request'),
    });
    global.fetch = mockFetch;

    const provider = LLMProviderFactory.create({
      provider: 'gemini' as LLMProvider,
      apiKey: 'test-key',
    });

    await expect(provider.generateText('Hello')).rejects.toThrow('Gemini API error');
  });

  it('should return true on successful testConnection', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const provider = LLMProviderFactory.create({
      provider: 'gemini' as LLMProvider,
      apiKey: 'test-key',
    });

    const result = await provider.testConnection();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/openai/models',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toBe(true);
  });

  it('should return false when testConnection gets non-OK response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    global.fetch = mockFetch;

    const provider = LLMProviderFactory.create({
      provider: 'gemini' as LLMProvider,
      apiKey: 'test-key',
    });

    const result = await provider.testConnection();
    expect(result).toBe(false);
  });

  it('should return false when testConnection throws network error', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = mockFetch;

    const provider = LLMProviderFactory.create({
      provider: 'gemini' as LLMProvider,
      apiKey: 'test-key',
    });

    const result = await provider.testConnection();
    expect(result).toBe(false);
  });
});
