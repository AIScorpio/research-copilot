import { NextResponse } from 'next/server';
import { z } from 'zod';
import { emailService } from '@/lib/email-service';
import { handleError, createValidationError } from '@/lib/error-handler';

const DigestConfigSchema = z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    recipientEmail: z.string().email(),
    includePowerPoint: z.boolean().default(false),
    includeSocialPosts: z.boolean().default(false),
    includeStats: z.boolean().default(true),
    maxPapers: z.number().min(1).max(50).default(20),
    topics: z.array(z.string()).optional(),
    days: z.number().min(1).max(365).default(7)
});

const ScheduleDigestSchema = z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    recipientEmail: z.string().email()
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        const validationResult = DigestConfigSchema.safeParse(body);
        if (!validationResult.success) {
            const error = createValidationError('Invalid input', { details: validationResult.error.issues });
            const handled = handleError(error);
            return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
        }
        
        const config = validationResult.data;
        
        const result = await emailService.sendDigest(config);
        
        return NextResponse.json({
            success: result.success,
            digest: {
                id: result.messageId,
                sentAt: new Date(),
                recipient: config.recipientEmail,
                paperCount: config.maxPapers,
                days: config.days
            },
            message: result.success ? 'Digest sent successfully' : result.error
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        
        const validationResult = ScheduleDigestSchema.safeParse(body);
        if (!validationResult.success) {
            const error = createValidationError('Invalid input', { details: validationResult.error.issues });
            const handled = handleError(error);
            return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
        }
        
        // Scheduling would be implemented with a background job system
        // For now, return success
        const scheduleId = `digest-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        return NextResponse.json({
            success: true,
            scheduleId,
            message: 'Digest scheduling not yet implemented - use POST to send immediately'
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}