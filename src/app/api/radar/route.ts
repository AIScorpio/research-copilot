import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateTechnologyRadar } from '@/lib/technology-radar';
import { handleError, createValidationError } from '@/lib/error-handler';

const RadarSchema = z.object({
    days: z.number().min(1).max(365).default(90)
});

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '90');

        const validationResult = RadarSchema.safeParse({ days });
        if (!validationResult.success) {
            const error = createValidationError('Invalid input', { details: validationResult.error.issues });
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        const radar = await generateTechnologyRadar(validationResult.data.days);

        return NextResponse.json({
            success: true,
            radar,
            count: radar.technologies.length
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const days = body.days || 90;

        const validationResult = RadarSchema.safeParse({ days });
        if (!validationResult.success) {
            const error = createValidationError('Invalid input', { details: validationResult.error.issues });
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        const radar = await generateTechnologyRadar(validationResult.data.days);

        return NextResponse.json({
            success: true,
            radarData: radar,
            count: radar.technologies.length
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}
