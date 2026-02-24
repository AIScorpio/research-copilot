import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/error-handler';

export async function GET() {
    try {
        const totalPapers = await prisma.paper.count();

        const allTags = await prisma.tag.findMany({
            include: {
                _count: {
                    select: { papers: true }
                }
            }
        });

        const categoryStats = {
            'ai-technology': allTags.filter(t => t.category === 'ai-technology').map(t => ({
                name: t.name,
                count: t._count.papers
            })).sort((a, b) => b.count - a.count),
            'business-area': allTags.filter(t => t.category === 'business-area').map(t => ({
                name: t.name,
                count: t._count.papers
            })).sort((a, b) => b.count - a.count),
            'methodology': allTags.filter(t => t.category === 'methodology').map(t => ({
                name: t.name,
                count: t._count.papers
            })).sort((a, b) => b.count - a.count),
            'risk-category': allTags.filter(t => t.category === 'risk-category').map(t => ({
                name: t.name,
                count: t._count.papers
            })).sort((a, b) => b.count - a.count),
            'regulatory': allTags.filter(t => t.category === 'regulatory').map(t => ({
                name: t.name,
                count: t._count.papers
            })).sort((a, b) => b.count - a.count),
        };

        return NextResponse.json({
            totalPapers,
            categoryStats
        });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
