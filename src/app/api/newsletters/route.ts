import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/error-handler';
import { schemas } from '@/lib/validation/schemas';
import { validateQueryParams, validateRequest } from '@/lib/validation/helpers';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const validation = validateQueryParams(schemas.newsletters.query, searchParams);
        if (!validation.success) return validation.response;

        const { limit } = validation.data;

        const logs = await prisma.newsletterLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                papers: {
                    select: {
                        id: true,
                        title: true,
                        source: true,
                        url: true
                    }
                }
            }
        });

        logger.debug(`API/Newsletters Found ${logs.length} logs`);
        return NextResponse.json({
            success: true,
            newsletters: logs
        });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}

export async function POST(request: Request) {
    try {
        const validation = validateRequest(schemas.newsletters.create, await request.json());
        if (!validation.success) return validation.response;

        const { title, content, dateCode, paperCount } = validation.data;

        const newsletter = await prisma.newsletterLog.create({
            data: {
                title,
                content,
                dateCode: dateCode || new Date().toISOString().split('T')[0],
                paperCount: paperCount || 0
            }
        });

        return NextResponse.json({
            success: true,
            newsletter
        });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
