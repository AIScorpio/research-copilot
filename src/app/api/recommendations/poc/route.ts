import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generatePoCRecommendations } from '@/lib/recommendations';
import { handleError, createValidationError } from '@/lib/error-handler';

const RecommendationSchema = z.object({
    limit: z.number().min(1).max(50).default(10),
    domain: z.string().optional()
});

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');
        const domain = searchParams.get('domain') || undefined;
        
        const validationResult = RecommendationSchema.safeParse({ limit, domain });
        if (!validationResult.success) {
            return NextResponse.json({ 
                error: "Invalid input: " + validationResult.error.issues.map((e: any) => e.message).join(', ')
            }, { status: 400 });
        }

        const recommendations = await generatePoCRecommendations(
            validationResult.data.limit,
            validationResult.data.domain
        );

        return NextResponse.json({
            success: true,
            recommendations,
            count: recommendations.length,
            domain: validationResult.data.domain
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}

export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');
        const domain = searchParams.get('domain') || undefined;

        const validationResult = RecommendationSchema.safeParse({ limit, domain });
        if (!validationResult.success) {
            const error = createValidationError('Invalid input', { details: validationResult.error.issues });
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        const recommendations = await generatePoCRecommendations(
            validationResult.data.limit,
            validationResult.data.domain
        );

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
