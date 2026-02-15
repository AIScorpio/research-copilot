import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/error-handler';
import { schemas } from '@/lib/validation/schemas';
import { validateQueryParams } from '@/lib/validation/helpers';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const validation = validateQueryParams(schemas.papers.query, searchParams);
    if (!validation.success) return validation.response;

    const { search, sector, topic, page, pageSize } = validation.data;
    const skip = (page - 1) * pageSize;

    const whereClause: any = {};

    if (search) {
        whereClause.OR = [
            { title: { contains: search } },
            { abstract: { contains: search } }
        ];
    }

    if (sector || topic) {
        whereClause.tags = {
            some: {
                tag: {
                    OR: []
                }
            }
        };

        if (sector) whereClause.tags.some.tag.OR.push({ name: sector });
        if (topic) whereClause.tags.some.tag.OR.push({ name: topic });
    }

    try {
        const [papers, total] = await Promise.all([
            prisma.paper.findMany({
                where: whereClause,
                include: {
                    tags: {
                        include: {
                            tag: true
                        }
                    },
                    favoritedBy: true
                },
                orderBy: {
                    collectedAt: 'desc'
                },
                take: pageSize,
                skip: skip,
            }),
            prisma.paper.count({ where: whereClause })
        ]);

        const formattedPapers = papers.map(p => ({
            ...p,
            tags: p.tags.map(pt => pt.tag)
        }));

        return NextResponse.json({
            papers: formattedPapers,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
                hasNextPage: skip + papers.length < total,
                hasPreviousPage: page > 1,
            }
        });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
