import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError, createValidationError } from '@/lib/error-handler';

/**
 * DELETE /api/papers/[id]
 * Remove a paper from the repository
 */
export async function DELETE(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const { id } = await props.params;

    try {
        // We use a transaction to ensure all relations are handled cleanup
        // (Though with Cascade Delete in schema it might be automatic, explicit is safer if not fully configured)
        await prisma.$transaction([
            prisma.paperTag.deleteMany({ where: { paperId: id } }),
            prisma.userTag.deleteMany({ where: { paperId: id } }),
            prisma.userFavorite.deleteMany({ where: { paperId: id } }),
            prisma.paper.delete({ where: { id } })
        ]);

        return NextResponse.json({ success: true, message: "Paper removed successfully" });
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
