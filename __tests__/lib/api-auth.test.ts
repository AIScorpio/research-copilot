import { jest } from '@jest/globals';

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: jest.fn() },
}));
jest.mock('@/lib/db', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));
jest.mock('@/lib/session', () => ({
  requireAuth: jest.fn(),
}));

const { authenticateRequest } = require('@/lib/api-auth');
const { requireAuth } = require('@/lib/session');

function makeRequest(headers: Record<string, string>) {
  return { headers: { get: (key: string) => headers[key] ?? null } } as any;
}

describe('API Auth Module', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    (requireAuth as jest.Mock).mockClear();
  });

  it('should return api_key identity when valid API key is provided', async () => {
    const originalKey = process.env.COPILOT_API_KEY;
    process.env.COPILOT_API_KEY = 'valid-secret-key';

    const request = makeRequest({ 'x-api-key': 'valid-secret-key' });
    const identity = await authenticateRequest(request);

    expect(identity).toEqual({ type: 'api_key', name: 'copilot' });

    process.env.COPILOT_API_KEY = originalKey;
  });

  it('should return null when API key is invalid', async () => {
    const originalKey = process.env.COPILOT_API_KEY;
    process.env.COPILOT_API_KEY = 'valid-secret-key';

    const request = makeRequest({ 'x-api-key': 'wrong-key' });
    const identity = await authenticateRequest(request);

    expect(identity).toBeNull();

    process.env.COPILOT_API_KEY = originalKey;
  });

  it('should return session identity when no API key and valid session exists', async () => {
    const originalKey = process.env.COPILOT_API_KEY;
    delete process.env.COPILOT_API_KEY;

    (requireAuth as jest.Mock).mockResolvedValue({ id: 'user-1', email: 'test@example.com' });

    const request = makeRequest({});
    const identity = await authenticateRequest(request);

    expect(identity).toEqual({ type: 'session', userId: 'user-1', email: 'test@example.com' });
    expect(requireAuth).toHaveBeenCalled();

    process.env.COPILOT_API_KEY = originalKey;
  });

  it('should return null when no API key and requireAuth throws', async () => {
    const originalKey = process.env.COPILOT_API_KEY;
    delete process.env.COPILOT_API_KEY;

    (requireAuth as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

    const request = makeRequest({});
    const identity = await authenticateRequest(request);

    expect(identity).toBeNull();

    process.env.COPILOT_API_KEY = originalKey;
  });

  it('should return null when API key is present but COPILOT_API_KEY is not set', async () => {
    const originalKey = process.env.COPILOT_API_KEY;
    delete process.env.COPILOT_API_KEY;

    const request = makeRequest({ 'x-api-key': 'some-key' });
    const identity = await authenticateRequest(request);

    expect(identity).toBeNull();
    expect(requireAuth).not.toHaveBeenCalled();

    process.env.COPILOT_API_KEY = originalKey;
  });
});
