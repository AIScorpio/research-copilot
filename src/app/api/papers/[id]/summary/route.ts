import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateSummary } from '@/lib/llm';

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
            return NextResponse.json({ error: "Paper not found" }, { status: 404 });
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
        console.error('[API/Summary] Error:', error);
        return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
    }
}
