import { NextResponse } from 'next/server';
import { retrieveContext, generateResponse } from '@/lib/rag';

export async function POST(request: Request) {
    try {
        const { messages } = await request.json();
        const lastMessage = messages[messages.length - 1];
        const query = lastMessage.content;

        // 1. Retrieve
        const context = await retrieveContext(query);

        // 2. Generate
        const answer = await generateResponse(query, context);

        return NextResponse.json({
            role: 'assistant',
            content: answer,
            sources: context // Optional: returning sources for UI citation
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to chat' }, { status: 500 });
    }
}
