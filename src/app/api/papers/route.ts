import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sector = searchParams.get('sector'); // Industrial Filter
    const topic = searchParams.get('topic'); // Academic Filter

    const whereClause: any = {};

    if (search) {
        whereClause.OR = [
            { title: { contains: search } }, // Case insensitive in SQLite usually, but Prisma might need specific config
            { abstract: { contains: search } }
        ];
    }

    // Filter by Tags
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
        const papers = await prisma.paper.findMany({
            where: whereClause,
            include: {
                tags: {
                    include: {
                        tag: true
                    }
                },
                favoritedBy: true // To check if current user favorited (need user context later)
            },
            orderBy: {
                publicationDate: 'desc'
            }
        });

        // Helper to format response
        const formattedPapers = papers.map(p => ({
            ...p,
            tags: p.tags.map(pt => pt.tag)
        }));

        return NextResponse.json(formattedPapers);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch papers' }, { status: 500 });
    }
}
