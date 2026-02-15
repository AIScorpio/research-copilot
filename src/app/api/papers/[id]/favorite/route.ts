import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError, createValidationError } from '@/lib/error-handler';
import { getAuthUser } from '@/lib/session';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const paperId = resolvedParams.id;

        if (!paperId) {
            const error = createValidationError('Paper ID is required');
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(paperId)) {
            const error = createValidationError('Invalid paper ID format. Expected UUID v4 format', { paperId });
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        // Get user from session
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized', message: 'Please login to favorite papers' },
                { status: 401 }
            );
        }
        const userId = user.id;

        const existing = await prisma.userFavorite.findUnique({
            where: {
                userId_paperId: {
                    userId: userId,
                    paperId: paperId
                }
            }
        });

        if (existing) {
            await prisma.userFavorite.delete({
                where: {
                    userId_paperId: {
                        userId: userId,
                        paperId: paperId
                    }
                }
            });
            return NextResponse.json({ favorited: false });
        } else {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                const error = createValidationError('User not found');
                const handled = handleError(error);
                return NextResponse.json(handled, { status: handled.statusCode });
            }

            await prisma.userFavorite.create({
                data: {
                    userId: user.id,
                    paperId: paperId
                }
            });
            return NextResponse.json({ favorited: true });
        }
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
