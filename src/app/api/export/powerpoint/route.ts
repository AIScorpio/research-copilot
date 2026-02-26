import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { generatePowerPoint } from '@/lib/ppt-generator';
import { handleError, createValidationError } from '@/lib/error-handler';

const ExportSchema = z.object({
    days: z.number().min(1).max(365).default(30),
    limit: z.number().min(1).max(50).default(10),
    search: z.string().max(200).optional(),
    includeAbstract: z.boolean().default(true),
    includeSummary: z.boolean().default(true),
    includeTags: z.boolean().default(true)
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        const validationResult = ExportSchema.safeParse(body);
        if (!validationResult.success) {
            const error = createValidationError('Invalid input', { details: validationResult.error.issues });
            const handled = handleError(error);
            return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
        }

        const { days, limit, search, includeAbstract, includeSummary, includeTags } = validationResult.data;

        const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const whereClause: any = {
            publicationDate: { gte: sinceDate }
        };

        if (search) {
            whereClause.OR = [
                { title: { contains: search } },
                { abstract: { contains: search } }
            ];
        }

        const papers = await prisma.paper.findMany({
            where: whereClause,
            include: {
                tags: {
                    include: {
                        tag: true
                    }
                }
            },
            orderBy: {
                publicationDate: 'desc'
            },
            take: limit
        });

        const formattedPapers = papers.map((p: typeof papers[0]) => ({
            id: p.id,
            title: p.title,
            abstract: p.abstract || undefined,
            url: p.url,
            source: p.source,
            publicationDate: p.publicationDate,
            aiSummary: p.aiSummary || undefined,
            assessmentReason: p.assessmentReason || undefined,
            tags: p.tags.map(pt => ({ id: pt.tag.id, name: pt.tag.name, category: pt.tag.category }))
        }));

        const pptxBuffer = await generatePowerPoint(formattedPapers, {
            title: search ? `${search} - Research Briefing` : 'Research Intelligence Briefing',
            subtitle: 'AI in Banking & Finance',
            includeAbstract,
            includeSummary,
            includeTags
        });

        return new NextResponse(pptxBuffer as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'Content-Disposition': `attachment; filename="research-briefing-${new Date().toISOString().split('T')[0]}.pptx"`
            }
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}