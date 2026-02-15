import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generatePoCRecommendations } from '@/lib/recommendations';
import { handleError, createValidationError } from '@/lib/error-handler';

const RecommendationsSchema = z.object({
    limit: z.number().min(1).max(50).default(10)
});

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');
        
        const validationResult = RecommendationsSchema.safeParse({ limit });
        if (!validationResult.success) {
            const error = createValidationError('Invalid input', { details: validationResult.error.issues });
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        const recommendations = await generatePoCRecommendations(validationResult.data.limit);

        return NextResponse.json({
            success: true,
            recommendations,
            count: recommendations.length
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}