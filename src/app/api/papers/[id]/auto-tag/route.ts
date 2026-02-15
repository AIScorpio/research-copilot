import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateTags } from '@/lib/llm';
import { handleError, createNotFoundError } from '@/lib/error-handler';

export async function POST(
    request: Request,
    props: any
) {
    const params = await props.params;
    const { id } = params;

    try {
        const paper = await prisma.paper.findUnique({ where: { id } });
        if (!paper) {
            const error = createNotFoundError('Paper');
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        // Use LLM to extract research topics from paper
        const suggestedTags = await generateTags(paper.title, paper.abstract || '');

        // Filter out tags that already exist on this paper
        const existingTags = await prisma.paperTag.findMany({
            where: { paperId: id },
            include: { tag: true }
        });
        const existingNames = new Set(existingTags.map((pt) => pt.tag.name.toLowerCase()));

        const newSuggestions = suggestedTags
            .filter(t => !existingNames.has(t.toLowerCase()))
            .map(name => ({ name, type: "Academic" }));

        console.log('[Auto-Tag] Final suggestions:', newSuggestions);

        return NextResponse.json({ candidates: newSuggestions });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, candidates: [] }, { status: handled.statusCode });
    }
}
