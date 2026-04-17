import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/error-handler';
import { validateRequest } from '@/lib/validation/helpers';
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

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    return withAuth(async (request: Request, user: any) => {
        try {
            const { id } = await params;

            const session = await prisma.chatSession.findUnique({
                where: { id },
                include: {
                    messages: { orderBy: { createdAt: 'asc' } },
                },
            });

            if (!session || session.userId !== user.id) {
                return NextResponse.json(
                    { error: 'Session not found' },
                    { status: 404 }
                );
            }

            const sessionData = {
                id: session.id,
                title: session.title,
                model: parseModelJson(session.model),
                createdAt: session.createdAt.toISOString(),
                updatedAt: session.updatedAt.toISOString(),
                lastMessageAt: session.lastMessageAt.toISOString(),
            };

            const messages = session.messages.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                sources: m.role === 'assistant' ? parseSourcesJson(m.sources) : null,
                createdAt: m.createdAt.toISOString(),
            }));

            return NextResponse.json({ session: sessionData, messages });
        } catch (error) {
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }
    })(request);
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    return withAuth(async (request: Request, user: any) => {
        try {
            const { id } = await params;

            const session = await prisma.chatSession.findUnique({ where: { id } });
            if (!session || session.userId !== user.id) {
                return NextResponse.json(
                    { error: 'Session not found' },
                    { status: 404 }
                );
            }

            const body = await request.json();
            const validation = validateRequest(schemas.chatSessions.update, body);
            if (!validation.success) return validation.response;

            const updated = await prisma.chatSession.update({
                where: { id },
                data: { title: validation.data.title },
            });

            return NextResponse.json({
                id: updated.id,
                title: updated.title,
                updatedAt: updated.updatedAt.toISOString(),
            });
        } catch (error) {
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }
    })(request);
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    return withAuth(async (request: Request, user: any) => {
        try {
            const { id } = await params;

            const session = await prisma.chatSession.findUnique({ where: { id } });
            if (!session || session.userId !== user.id) {
                return NextResponse.json(
                    { error: 'Session not found' },
                    { status: 404 }
                );
            }

            await prisma.chatSession.delete({ where: { id } });

            return NextResponse.json({ success: true });
        } catch (error) {
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }
    })(request);
}
