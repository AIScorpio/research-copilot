import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateTagsWithLLM } from '@/lib/tag-generator';
import { ensureLLMInitialized } from '@/lib/llm-service';
import { handleError, createNotFoundError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

export async function POST(
    request: Request,
    props: any
) {
    const params = await props.params;
    const { id } = params;

    try {
        // Initialize LLM providers from database to ensure correct configuration
        await ensureLLMInitialized();

        const paper = await prisma.paper.findUnique({ where: { id } });
        if (!paper) {
            const error = createNotFoundError('Paper');
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        const existingTags = await prisma.paperTag.findMany({
            where: { paperId: id },
            include: { tag: true }
        });
        const existingNames = existingTags.map((pt) => pt.tag.name);

        const tagResult = await generateTagsWithLLM(paper.title, paper.abstract || '', existingNames);

        const existingNamesSet = new Set(existingNames.map(n => n.toLowerCase()));
        const newSuggestions = tagResult.tags
            .filter(t => !existingNamesSet.has(t.name.toLowerCase()))
            .map(t => ({ name: t.name, category: t.category }));

        logger.debug('[Auto-Tag] Final suggestions:', { suggestions: newSuggestions });

        return NextResponse.json({ candidates: newSuggestions });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, candidates: [] }, { status: handled.statusCode });
    }
}
