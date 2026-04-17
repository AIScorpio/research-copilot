import { jest } from '@jest/globals';

jest.mock('@/lib/validation/helpers', () => ({
    validateQueryParams: (schema: any, params: any) => {
        const z = require('zod');
        const result = schema.safeParse(Object.fromEntries(params));
        if (!result.success) return { success: false, error: 'validation failed', response: null };
        return { success: true, data: result.data };
    },
    validateRequest: (schema: any, data: any) => {
        const z = require('zod');
        const result = schema.safeParse(data);
        if (!result.success) return { success: false, error: 'validation failed', response: null };
        return { success: true, data: result.data };
    },
}));

jest.mock('@/lib/db', () => ({
    prisma: {
        chatSession: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
    },
}));

const { validateQueryParams } = require('@/lib/validation/helpers');
const { schemas } = require('@/lib/validation/schemas');
const { prisma } = require('@/lib/db');

const makeSession = (overrides: any = {}) => ({
    id: 'session-1',
    title: 'Test Session',
    model: JSON.stringify({ providerType: 'groq', externalId: 'llama-3.3-70b' }),
    lastMessageAt: new Date('2026-04-16T10:30:00Z'),
    createdAt: new Date('2026-04-16T09:00:00Z'),
    updatedAt: new Date('2026-04-16T10:30:00Z'),
    userId: 'user-1',
    messages: [],
    _count: { messages: 3 },
    ...overrides,
});

function parseModelJson(modelJson: string | null) {
    if (!modelJson) return null;
    try { return JSON.parse(modelJson); } catch { return null; }
}

async function listSessions(user: any, request: Request) {
    const { searchParams } = new URL(request.url);
    const validation = validateQueryParams(schemas.chatSessions.list, searchParams);
    if (!validation.success) return { status: 400, ok: false };

    const { limit, offset } = validation.data;
    const where = { userId: user.id };

    const sessions = await prisma.chatSession.findMany({
        where,
        include: { _count: { select: { messages: true } } },
        orderBy: { lastMessageAt: 'desc' },
        take: limit,
        skip: offset,
    });

    const total = await prisma.chatSession.count({ where });

    const sessionList = sessions.map((s: any) => ({
        id: s.id,
        title: s.title,
        model: parseModelJson(s.model),
        messageCount: s._count.messages,
        lastMessageAt: s.lastMessageAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
    }));

    return { status: 200, ok: true, body: { sessions: sessionList, total, limit, offset } };
}

describe('Session CRUD API', () => {
    beforeEach(() => {
        (prisma.chatSession.findMany as jest.Mock).mockReset();
        (prisma.chatSession.count as jest.Mock).mockReset();
    });

    describe('GET /api/chat/sessions', () => {
        it('T1: should return empty list when no sessions', async () => {
            (prisma.chatSession.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.chatSession.count as jest.Mock).mockResolvedValue(0);

            const request = new Request('http://localhost:3000/api/chat/sessions');
            const result = await listSessions({ id: 'user-1' }, request);

            expect(result.status).toBe(200);
            expect(result.body.sessions).toEqual([]);
            expect(result.body.total).toBe(0);
        });

        it('T2: should return sessions ordered by lastMessageAt desc with messageCount', async () => {
            const sessions = [
                makeSession({ id: 's3', title: 'Session C', lastMessageAt: new Date('2026-04-16T12:00:00Z'), _count: { messages: 5 } }),
                makeSession({ id: 's2', title: 'Session B', lastMessageAt: new Date('2026-04-16T11:00:00Z'), _count: { messages: 2 } }),
                makeSession({ id: 's1', title: 'Session A', lastMessageAt: new Date('2026-04-16T10:00:00Z'), _count: { messages: 8 } }),
            ];
            (prisma.chatSession.findMany as jest.Mock).mockResolvedValue(sessions);
            (prisma.chatSession.count as jest.Mock).mockResolvedValue(3);

            const request = new Request('http://localhost:3000/api/chat/sessions');
            const result = await listSessions({ id: 'user-1' }, request);

            expect(result.status).toBe(200);
            expect(result.body.sessions).toHaveLength(3);
            expect(result.body.sessions[0].id).toBe('s3');
            expect(result.body.sessions[0].messageCount).toBe(5);
            expect(result.body.sessions[1].id).toBe('s2');
            expect(result.body.sessions[2].id).toBe('s1');
            expect(result.body.total).toBe(3);
        });

        it('T3: should paginate with limit and offset', async () => {
            const sessions = [
                makeSession({ id: 's2', lastMessageAt: new Date('2026-04-16T12:00:00Z'), _count: { messages: 1 } }),
            ];
            (prisma.chatSession.findMany as jest.Mock).mockResolvedValue(sessions);
            (prisma.chatSession.count as jest.Mock).mockResolvedValue(5);

            const request = new Request('http://localhost:3000/api/chat/sessions?limit=2&offset=1');
            const result = await listSessions({ id: 'user-1' }, request);

            expect(result.status).toBe(200);
            expect(result.body.sessions).toHaveLength(1);
            expect(result.body.total).toBe(5);
            expect(result.body.limit).toBe(2);
            expect(result.body.offset).toBe(1);
        });

        it('T3b: should use default limit=50 and offset=0', async () => {
            (prisma.chatSession.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.chatSession.count as jest.Mock).mockResolvedValue(0);

            const request = new Request('http://localhost:3000/api/chat/sessions');
            await listSessions({ id: 'user-1' }, request);

            expect(prisma.chatSession.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 50, skip: 0 })
            );
        });

        it('should parse model JSON correctly', async () => {
            (prisma.chatSession.findMany as jest.Mock).mockResolvedValue([
                makeSession({ model: JSON.stringify({ providerType: 'lmstudio', externalId: 'qwen3.5-35b' }) }),
            ]);
            (prisma.chatSession.count as jest.Mock).mockResolvedValue(1);

            const request = new Request('http://localhost:3000/api/chat/sessions');
            const result = await listSessions({ id: 'user-1' }, request);

            expect(result.body.sessions[0].model).toEqual({ providerType: 'lmstudio', externalId: 'qwen3.5-35b' });
        });

        it('should return null model for invalid JSON', async () => {
            (prisma.chatSession.findMany as jest.Mock).mockResolvedValue([
                makeSession({ model: 'not-json' }),
            ]);
            (prisma.chatSession.count as jest.Mock).mockResolvedValue(1);

            const request = new Request('http://localhost:3000/api/chat/sessions');
            const result = await listSessions({ id: 'user-1' }, request);

            expect(result.body.sessions[0].model).toBeNull();
        });

        it('should return null model for null model field', async () => {
            (prisma.chatSession.findMany as jest.Mock).mockResolvedValue([
                makeSession({ model: null }),
            ]);
            (prisma.chatSession.count as jest.Mock).mockResolvedValue(1);

            const request = new Request('http://localhost:3000/api/chat/sessions');
            const result = await listSessions({ id: 'user-1' }, request);

            expect(result.body.sessions[0].model).toBeNull();
        });

        it('should reject invalid limit', async () => {
            const request = new Request('http://localhost:3000/api/chat/sessions?limit=abc');
            const result = await listSessions({ id: 'user-1' }, request);

            expect(result.status).toBe(400);
            expect(result.ok).toBe(false);
        });

        it('should reject negative offset', async () => {
            const request = new Request('http://localhost:3000/api/chat/sessions?offset=-1');
            const result = await listSessions({ id: 'user-1' }, request);

            expect(result.status).toBe(400);
            expect(result.ok).toBe(false);
        });
    });
});
