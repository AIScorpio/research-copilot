import { NextResponse } from 'next/server';
import { z } from 'zod';
import { retrieveContext, generateResponse } from '@/lib/rag';
import { handleError, createValidationError } from '@/lib/error-handler';

const ChatSchema = z.object({
    messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().max(5000)
    })).min(1).max(50)
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        const validationResult = ChatSchema.safeParse(body);
        if (!validationResult.success) {
            const error = createValidationError('Invalid input', { details: validationResult.error.issues });
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }
        
        const { messages } = validationResult.data;
        const lastMessage = messages[messages.length - 1];
        const query = lastMessage.content;

        // 1. Retrieve
        const context = await retrieveContext(query);

        // 2. Generate
        const answer = await generateResponse(query, context);

        return NextResponse.json({
            role: 'assistant',
            content: answer,
            sources: context
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
