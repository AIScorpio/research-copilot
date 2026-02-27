import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { initSocialSource, completeOAuth, getSocialCredentials } from '@/lib/social-collector';
import { handleError, createValidationError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

const InitAuthSchema = z.object({
    platform: z.enum(['reddit', 'linkedin', 'twitter', 'mastodon']),
    sourceId: z.string().optional().default('default'),
    authConfig: z.object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
        redirectUri: z.string().optional(),
        scopes: z.array(z.string()).optional(),
    }).optional(),
});

const CompleteAuthSchema = z.object({
    platform: z.enum(['reddit', 'linkedin', 'twitter', 'mastodon']),
    code: z.string(),
    state: z.string(),
});

/**
 * Initialize OAuth flow for a social media platform
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { platform, sourceId, authConfig } = InitAuthSchema.parse(body);

        logger.debug(`[Auth] Initializing ${platform} OAuth`);

        // Initialize the OAuth flow
        const result = await initSocialSource(sourceId, platform, authConfig || {
            clientId: process.env[`${platform.toUpperCase()}_CLIENT_ID`],
            redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
            scopes: ['read'],
        });

        return NextResponse.json({
            success: true,
            authUrl: result.authUrl,
            platform,
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}

/**
 * Complete OAuth callback
 * Called by OAuth provider with authorization code
 */
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { platform, code, state } = CompleteAuthSchema.parse(body);

        logger.debug(`[Auth] Completing ${platform} OAuth`);

        // Complete the OAuth flow and store credentials
        await completeOAuth(platform, code, state);

        return NextResponse.json({
            success: true,
            message: 'Authentication successful',
            platform,
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}

/**
 * Get authentication status for a social media platform
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const platform = searchParams.get('platform') as 'reddit' | 'linkedin' | 'twitter' | 'mastodon' | null;
        const sourceId = searchParams.get('sourceId') || 'default';

        if (!platform) {
            const error = createValidationError('Platform parameter is required');
            const handled = handleError(error);
            return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
        }

        const creds = await getSocialCredentials(sourceId, platform);

        return NextResponse.json({
            success: true,
            authenticated: !!creds,
            username: creds?.username,
            expiresAt: creds?.expiresAt,
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}

/**
 * Delete/remove credentials for a social media platform
 */
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const platform = searchParams.get('platform') as 'reddit' | 'linkedin' | 'twitter' | 'mastodon' | null;
        const sourceId = searchParams.get('sourceId') || 'default';

        if (!platform) {
            const error = createValidationError('Platform parameter is required');
            const handled = handleError(error);
            return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
        }

        await prisma.socialCredential.deleteMany({
            where: {
                sourceId,
                platform,
            },
        });

        logger.debug(`[Auth] Removed credentials for ${platform}`);

        return NextResponse.json({
            success: true,
            message: 'Credentials removed successfully',
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
    }
}
