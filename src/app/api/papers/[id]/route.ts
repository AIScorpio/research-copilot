import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError, createValidationError, createNotFoundError } from '@/lib/error-handler';

/**
 * DELETE /api/papers/[id]
 * Remove a paper from the repository with archival
 */
export async function DELETE(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const { id } = await props.params;

    try {
        const paper = await prisma.paper.findUnique({
            where: { id }
        });

        if (!paper) {
            const error = createNotFoundError('Paper');
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        await prisma.$transaction([
            prisma.deletedPaper.upsert({
                where: { originalId: paper.id },
                update: {
                    title: paper.title,
                    abstract: paper.abstract,
                    url: paper.url,
                    source: paper.source,
                    sourceType: paper.sourceType,
                    publicationDate: paper.publicationDate,
                    collectedAt: paper.collectedAt,
                    aiSummary: paper.aiSummary,
                    relevanceScore: paper.relevanceScore,
                    technicalScore: paper.technicalScore,
                    businessScore: paper.businessScore,
                    timelinessScore: paper.timelinessScore,
                    practicalityScore: paper.practicalityScore,
                    assessmentReason: paper.assessmentReason,
                    technicalBonusApplied: paper.technicalBonusApplied,
                    deletedAt: new Date(),
                },
                create: {
                    originalId: paper.id,
                    title: paper.title,
                    abstract: paper.abstract,
                    url: paper.url,
                    source: paper.source,
                    sourceType: paper.sourceType,
                    publicationDate: paper.publicationDate,
                    collectedAt: paper.collectedAt,
                    aiSummary: paper.aiSummary,
                    relevanceScore: paper.relevanceScore,
                    technicalScore: paper.technicalScore,
                    businessScore: paper.businessScore,
                    timelinessScore: paper.timelinessScore,
                    practicalityScore: paper.practicalityScore,
                    assessmentReason: paper.assessmentReason,
                    technicalBonusApplied: paper.technicalBonusApplied,
                }
            }),
            prisma.paperTag.deleteMany({ where: { paperId: id } }),
            prisma.userTag.deleteMany({ where: { paperId: id } }),
            prisma.userFavorite.deleteMany({ where: { paperId: id } }),
            prisma.paper.delete({ where: { id } })
        ]);

        return NextResponse.json({ success: true, message: "Paper removed and archived successfully" });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}

/**
 * PATCH /api/papers/[id]
 * Update paper metadata (e.g. publication date)
 */
export async function PATCH(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const { id } = await props.params;

    try {
        const body = await request.json();
        const { publicationDate } = body;

        const updateData: any = {};
        if (publicationDate) {
            updateData.publicationDate = new Date(publicationDate);
        }

        if (Object.keys(updateData).length === 0) {
            const error = createValidationError('No update fields provided');
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        const paper = await prisma.paper.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json({ success: true, paper });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
