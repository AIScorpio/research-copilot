import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateSocialMediaPosts } from '@/lib/social-media';
import { handleError, createValidationError } from '@/lib/error-handler';

const SocialMediaSchema = z.object({
    paperIds: z.array(z.string()).optional(),
    platform: z.enum(['LinkedIn', 'Twitter', 'X']).default('LinkedIn'),
    count: z.number().min(1).max(10).default(1)
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        const validationResult = SocialMediaSchema.safeParse(body);
        if (!validationResult.success) {
            const error = createValidationError('Invalid input', { details: validationResult.error.issues });
            const handled = handleError(error);
            return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
        }

        const { paperIds, platform, count } = validationResult.data;

        const posts = await generateSocialMediaPosts(paperIds, platform, count);

        return NextResponse.json({
            success: true,
            posts,
            count: posts.length,
            platform
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}