import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateSummary } from '@/lib/llm';
import { handleError, createNotFoundError } from '@/lib/error-handler';

export async function POST(
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

        // Generate summary if not already present or force refresh
        const summary = await generateSummary(paper.title, paper.abstract || '');

        // Update database
        await prisma.paper.update({
            where: { id },
            data: { aiSummary: summary }
        });

        return NextResponse.json({ summary });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
