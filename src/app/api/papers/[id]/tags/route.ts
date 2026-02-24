import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError, createValidationError } from '@/lib/error-handler';
import { schemas } from '@/lib/validation/schemas';
import { validateRequest } from '@/lib/validation/helpers';

export async function POST(
    request: Request,
    props: any
) {
    try {
        const params = await props.params;
        const { id } = params;
        const validation = validateRequest(schemas.papers.addTag, await request.json());
        if (!validation.success) return validation.response;

        const { tagName } = validation.data;

        let dbTag = await prisma.tag.findUnique({
            where: { name: tagName }
        });

        if (!dbTag) {
            dbTag = await prisma.tag.create({
                data: {
                    name: tagName,
                    category: "uncategorized"
                }
            });
        }

        const existingLink = await prisma.paperTag.findUnique({
            where: {
                paperId_tagId: {
                    paperId: id,
                    tagId: dbTag.id
                }
            }
        });

        if (!existingLink) {
            await prisma.paperTag.create({
                data: {
                    paperId: id,
                    tagId: dbTag.id
                }
            });
        }

        return NextResponse.json({
            id: dbTag.id,
            tagName: dbTag.name,
            category: dbTag.category
        });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}

export async function DELETE(
    request: Request,
    props: any
) {
    try {
        const params = await props.params;
        const { id } = params;
        const validation = validateRequest(schemas.papers.removeTag, await request.json());
        if (!validation.success) return validation.response;

        const { tagId } = validation.data;

        await prisma.paperTag.deleteMany({
            where: {
                paperId: id,
                tagId: tagId
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
