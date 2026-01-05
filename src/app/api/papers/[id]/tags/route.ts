import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const MOCK_USER_ID = "user-1";

export async function POST(
    request: Request,
    props: any
) {
    const params = await props.params;
    const { id } = params;
    const { tagName } = await request.json();

    if (!tagName) return NextResponse.json({ error: "Missing tag name" }, { status: 400 });

    try {
        // Find or create global Tag
        let dbTag = await prisma.tag.findUnique({
            where: { name: tagName }
        });

        if (!dbTag) {
            dbTag = await prisma.tag.create({
                data: {
                    name: tagName,
                    type: "User Defined"
                }
            });
        }

        // Link Paper with Tag if not already linked
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

        // Return the tag in the format expected by UI
        return NextResponse.json({
            id: dbTag.id,
            tagName: dbTag.name,
            type: dbTag.type
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to add tag' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    props: any
) {
    const params = await props.params;
    const { id } = params;
    const { tagId } = await request.json();

    if (!tagId) return NextResponse.json({ error: "Missing tag ID" }, { status: 400 });

    try {
        // Remove the paper-tag association
        await prisma.paperTag.deleteMany({
            where: {
                paperId: id,
                tagId: tagId
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to remove tag' }, { status: 500 });
    }
}
