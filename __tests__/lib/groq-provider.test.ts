import { jest } from '@jest/globals';

const mockCreate = jest.fn();

jest.mock('groq-sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { GroqProvider } from '@/lib/llm-providers/groq';

describe('GroqProvider', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockCreate.mockReset();
  });

  it('verifies connections through the models endpoint without using a default chat model', async () => {
    const mockFetch = jest.fn(async () => ({ ok: true }) as Response);
    global.fetch = mockFetch as unknown as typeof fetch;

    const provider = new GroqProvider({
      provider: 'groq',
      apiKey: 'test-key',
    });

    const result = await provider.testConnection();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    );
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('returns false when the models endpoint rejects the API key', async () => {
    const mockFetch = jest.fn(async () => ({ ok: false, status: 401 }) as Response);
    global.fetch = mockFetch as unknown as typeof fetch;

    const provider = new GroqProvider({
      provider: 'groq',
      apiKey: 'test-key',
    });

    await expect(provider.testConnection()).resolves.toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
