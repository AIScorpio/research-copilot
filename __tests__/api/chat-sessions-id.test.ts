import { jest } from '@jest/globals';

jest.mock('@/lib/validation/helpers', () => ({
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
            findUnique: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    },
}));

const { validateRequest } = require('@/lib/validation/helpers');
const { schemas } = require('@/lib/validation/schemas');
const { prisma } = require('@/lib/db');

function parseModelJson(modelJson: string | null) {
    if (!modelJson) return null;
    try { return JSON.parse(modelJson); } catch { return null; }
}

function parseSourcesJson(sourcesJson: string | null) {
    if (!sourcesJson) return null;
    try { return JSON.parse(sourcesJson); } catch { return []; }
}

const makeSessionWithMessages = (overrides: any = {}) => ({
    id: 'session-1',
    title: 'Test Session',
    model: JSON.stringify({ providerType: 'groq', externalId: 'llama-3.3-70b' }),
    lastMessageAt: new Date('2026-04-16T10:30:00Z'),
    createdAt: new Date('2026-04-16T09:00:00Z'),
    updatedAt: new Date('2026-04-16T10:30:00Z'),
    userId: 'user-1',
    messages: [
        { id: 'msg-1', role: 'user', content: 'Hello', sources: null, createdAt: new Date('2026-04-16T09:01:00Z') },
        { id: 'msg-2', role: 'assistant', content: 'Based on 221 papers...', sources: JSON.stringify([{ id: 'p1', title: 'Paper One', url: 'https://example.com/1' }]), createdAt: new Date('2026-04-16T09:02:00Z') },
    ],
    ...overrides,
});

async function getSession(user: any, sessionId: string) {
    const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!session || session.userId !== user.id) {
        return { status: 404, body: null };
    }

    return {
        status: 200,
        body: {
            session: {
                id: session.id,
                title: session.title,
                model: parseModelJson(session.model),
                createdAt: session.createdAt.toISOString(),
                updatedAt: session.updatedAt.toISOString(),
                lastMessageAt: session.lastMessageAt.toISOString(),
            },
            messages: session.messages.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                sources: m.role === 'assistant' ? parseSourcesJson(m.sources) : null,
                createdAt: m.createdAt.toISOString(),
            })),
        },
    };
}

async function renameSession(user: any, sessionId: string, body: any) {
    const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== user.id) {
        return { status: 404, body: null };
    }

    const validation = validateRequest(schemas.chatSessions.update, body);
    if (!validation.success) {
        return { status: 400, body: null };
    }

    const updated = await prisma.chatSession.update({
        where: { id: sessionId },
        data: { title: validation.data.title },
    });

    return {
        status: 200,
        body: { id: updated.id, title: updated.title, updatedAt: updated.updatedAt.toISOString() },
    };
}

async function deleteSession(user: any, sessionId: string) {
    const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== user.id) {
        return { status: 404, body: null };
    }

    await prisma.chatSession.delete({ where: { id: sessionId } });

    return { status: 200, body: { success: true } };
}

describe('Session Detail API', () => {
    beforeEach(() => {
        (prisma.chatSession.findUnique as jest.Mock).mockReset();
        (prisma.chatSession.update as jest.Mock).mockReset();
        (prisma.chatSession.delete as jest.Mock).mockReset();
    });

    describe('GET /api/chat/sessions/[id]', () => {
        it('T4: should return session with messages and parsed sources', async () => {
            const session = makeSessionWithMessages();
            (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(session);

            const result = await getSession({ id: 'user-1' }, 'session-1');

            expect(result.status).toBe(200);
            expect(result.body.session.id).toBe('session-1');
            expect(result.body.session.title).toBe('Test Session');
            expect(result.body.session.model).toEqual({ providerType: 'groq', externalId: 'llama-3.3-70b' });
            expect(result.body.messages).toHaveLength(2);
            expect(result.body.messages[0].role).toBe('user');
            expect(result.body.messages[0].sources).toBeNull();
            expect(result.body.messages[1].role).toBe('assistant');
            expect(result.body.messages[1].sources).toEqual([{ id: 'p1', title: 'Paper One', url: 'https://example.com/1' }]);
        });

        it('T5: should return 404 for non-existent session', async () => {
            (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(null);

            const result = await getSession({ id: 'user-1' }, 'non-existent');

            expect(result.status).toBe(404);
            expect(result.body).toBeNull();
        });

        it('T6: should return 404 when session belongs to another user', async () => {
            (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(
                makeSessionWithMessages({ userId: 'user-2' })
            );

            const result = await getSession({ id: 'user-1' }, 'session-1');

            expect(result.status).toBe(404);
            expect(result.body).toBeNull();
        });

        it('should return null sources for user messages', async () => {
            const session = makeSessionWithMessages({
                messages: [{ id: 'm1', role: 'user', content: 'hi', sources: null, createdAt: new Date() }],
            });
            (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(session);

            const result = await getSession({ id: 'user-1' }, 'session-1');

            expect(result.body.messages[0].sources).toBeNull();
        });

        it('should return empty array for invalid sources JSON', async () => {
            const session = makeSessionWithMessages({
                messages: [{ id: 'm1', role: 'assistant', content: 'hi', sources: 'not-json', createdAt: new Date() }],
            });
            (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(session);

            const result = await getSession({ id: 'user-1' }, 'session-1');

            expect(result.body.messages[0].sources).toEqual([]);
        });
    });

    describe('PATCH /api/chat/sessions/[id]', () => {
        it('T7: should rename session', async () => {
            (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(makeSessionWithMessages());
            (prisma.chatSession.update as jest.Mock).mockResolvedValue({
                ...makeSessionWithMessages(),
                title: 'New Title',
            });

            const result = await renameSession({ id: 'user-1' }, 'session-1', { title: 'New Title' });

            expect(result.status).toBe(200);
            expect(result.body.title).toBe('New Title');
            expect(prisma.chatSession.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: { title: 'New Title' } })
            );
        });

        it('T8: should reject empty title', async () => {
            (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(makeSessionWithMessages());

            const result = await renameSession({ id: 'user-1' }, 'session-1', { title: '' });

            expect(result.status).toBe(400);
            expect(prisma.chatSession.update).not.toHaveBeenCalled();
        });

        it('should reject title > 200 chars', async () => {
            (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(makeSessionWithMessages());

            const result = await renameSession({ id: 'user-1' }, 'session-1', { title: 'x'.repeat(201) });

            expect(result.status).toBe(400);
            expect(prisma.chatSession.update).not.toHaveBeenCalled();
        });

        it('should return 404 for non-existent session', async () => {
            (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(null);

            const result = await renameSession({ id: 'user-1' }, 'non-existent', { title: 'New' });

            expect(result.status).toBe(404);
            expect(prisma.chatSession.update).not.toHaveBeenCalled();
        });

        it('should return 404 when session belongs to another user', async () => {
            (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(
                makeSessionWithMessages({ userId: 'user-2' })
            );

            const result = await renameSession({ id: 'user-1' }, 'session-1', { title: 'New' });

            expect(result.status).toBe(404);
            expect(prisma.chatSession.update).not.toHaveBeenCalled();
        });
    });

    describe('DELETE /api/chat/sessions/[id]', () => {
        it('T9: should delete session', async () => {
            (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(makeSessionWithMessages());
            (prisma.chatSession.delete as jest.Mock).mockResolvedValue(makeSessionWithMessages());

            const result = await deleteSession({ id: 'user-1' }, 'session-1');

            expect(result.status).toBe(200);
            expect(result.body.success).toBe(true);
            expect(prisma.chatSession.delete).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 'session-1' } })
            );
        });

        it('T10: should return 404 for non-existent session', async () => {
            (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(null);

            const result = await deleteSession({ id: 'user-1' }, 'non-existent');

            expect(result.status).toBe(404);
            expect(prisma.chatSession.delete).not.toHaveBeenCalled();
        });

        it('should return 404 when session belongs to another user', async () => {
            (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(
                makeSessionWithMessages({ userId: 'user-2' })
            );

            const result = await deleteSession({ id: 'user-1' }, 'session-1');

            expect(result.status).toBe(404);
            expect(prisma.chatSession.delete).not.toHaveBeenCalled();
        });
    });

    describe('IDOR protection', () => {
        it('T10b: should enforce ownership on GET (user A cannot access user B session)', async () => {
            (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(
                makeSessionWithMessages({ userId: 'user-2' })
            );

            const result = await getSession({ id: 'user-1' }, 'session-1');

            expect(result.status).toBe(404);
        });

        it('T10b: should enforce ownership on PATCH (user A cannot rename user B session)', async () => {
            (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(
                makeSessionWithMessages({ userId: 'user-2' })
            );

            const result = await renameSession({ id: 'user-1' }, 'session-1', { title: 'Hacked' });

            expect(result.status).toBe(404);
            expect(prisma.chatSession.update).not.toHaveBeenCalled();
        });

        it('T10b: should enforce ownership on DELETE (user A cannot delete user B session)', async () => {
            (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(
                makeSessionWithMessages({ userId: 'user-2' })
            );

            const result = await deleteSession({ id: 'user-1' }, 'session-1');

            expect(result.status).toBe(404);
            expect(prisma.chatSession.delete).not.toHaveBeenCalled();
        });
    });
});
