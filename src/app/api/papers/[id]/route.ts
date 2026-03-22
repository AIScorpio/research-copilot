import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError, createValidationError, createNotFoundError } from '@/lib/error-handler';
import { digestEngine } from '@/lib/daily-digest/engine';

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

        // Step 1: Find affected digests BEFORE deleting the paper
        const affectedDigests = await prisma.dailyDigestLog.findMany({
            where: {
                papers: {
                    some: { id }
                }
            },
            select: { id: true, dateCode: true }
        });
        
        console.log(`[DELETE] Paper ${id} found in ${affectedDigests.length} digests:`, affectedDigests.map(d => d.dateCode));

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
            // Step 2: Disconnect from digests in the same transaction
            ...affectedDigests.map(digest => 
                prisma.dailyDigestLog.update({
                    where: { id: digest.id },
                    data: {
                        papers: { disconnect: { id } }
                    }
                })
            ),
            prisma.paper.delete({ where: { id } })
        ]);

        // Step 3: Trigger digest update for affected digests (fire-and-forget)
        // P0 optimization: async update to avoid blocking delete operation
        if (affectedDigests.length > 0) {
            console.log(`[DELETE] Triggering digest update for:`, affectedDigests.map(d => d.dateCode));
            for (const digest of affectedDigests) {
                digestEngine.triggerDailyDigestUpdate(digest.dateCode).catch(err => {
                    console.error(`[DELETE] Failed to update digest ${digest.dateCode}:`, err);
                });
            }
        }

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
