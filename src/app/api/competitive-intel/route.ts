import { NextResponse } from 'next/server';
import { z } from 'zod';
import { trackCompetitiveUpdates, generateCompetitiveBrief } from '@/lib/competitive-intel';
import { handleError, createValidationError } from '@/lib/error-handler';

const CompetitiveSchema = z.object({
    days: z.number().min(1).max(365).default(30),
    limit: z.number().min(1).max(100).default(50)
});

/**
 * Get competitive intelligence updates
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '30');
        const limit = parseInt(searchParams.get('limit') || '50');
        
        const validationResult = CompetitiveSchema.safeParse({ days, limit });
        if (!validationResult.success) {
            const error = createValidationError('Invalid input', { details: validationResult.error.issues });
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }
        
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const updates = await trackCompetitiveUpdates(since);
        
        return NextResponse.json({
            success: true,
            updates: updates.slice(0, limit),
            count: updates.length,
            dateRange: {
                since: since.toISOString(),
                to: new Date().toISOString()
            }
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}

/**
 * Get competitive intelligence brief
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { days } = CompetitiveSchema.parse(body);
        
        const brief = await generateCompetitiveBrief(days);
        
        return NextResponse.json({
            success: true,
            brief,
            generatedAt: new Date()
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}
