import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/error-handler';
import { validateQueryParams } from '@/lib/validation/helpers';
import { schemas } from '@/lib/validation/schemas';
import { withAuth } from '@/lib/security';
import { logger } from '@/lib/logger';

function parseModelJson(modelJson: string | null) {
    if (!modelJson) return null;
    try {
        return JSON.parse(modelJson);
    } catch {
        return null;
    }
}

function parseSourcesJson(sourcesJson: string | null) {
    if (!sourcesJson) return null;
    try {
        return JSON.parse(sourcesJson);
    } catch {
        return [];
    }
}

export async function GET(request: Request) {
    return withAuth(async (request: Request, user: any) => {
        try {
            const { searchParams } = new URL(request.url);
            const validation = validateQueryParams(schemas.chatSessions.list, searchParams);
            if (!validation.success) return validation.response;

            const { limit, offset } = validation.data;

            const where = { userId: user.id };

            const sessions = await prisma.chatSession.findMany({
                where,
                include: {
                    _count: { select: { messages: true } },
                },
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

            return NextResponse.json({
                sessions: sessionList,
                total,
                limit,
                offset,
            });
        } catch (error) {
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }
    })(request);
}
