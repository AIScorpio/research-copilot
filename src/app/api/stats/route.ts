import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/error-handler';

export async function GET() {
    try {
        const totalPapers = await prisma.paper.count();

        // Get all tags with counts
        const allTags = await prisma.tag.findMany({
            include: {
                _count: {
                    select: { papers: true }
                }
            }
        });

        // Categorize by type
        const industrialTags = allTags.filter(t => t.type === 'Industrial');
        const academicTags = allTags.filter(t => t.type === 'Academic');
        const customTags = allTags.filter(t => t.type === 'User Defined');

        const industrialStats = industrialTags.map(t => ({
            name: t.name,
            count: t._count.papers
        })).sort((a, b) => b.count - a.count);

        const academicStats = academicTags.map(t => ({
            name: t.name,
            count: t._count.papers
        })).sort((a, b) => b.count - a.count);

        const customStats = customTags.map(t => ({
            name: t.name,
            count: t._count.papers
        })).sort((a, b) => b.count - a.count);

        return NextResponse.json({
            totalPapers,
            industrialStats,
            academicStats,
            customStats
        });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
