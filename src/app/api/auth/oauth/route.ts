import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { initOAuth } from '@/lib/oauth';
import { handleError, createValidationError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

const InitOAuthSchema = z.object({
  provider: z.enum(['google', 'github']),
  redirectUrl: z.string().optional().default('/'),
});

/**
 * POST /api/auth/oauth
 * Initialize OAuth flow for Google or GitHub
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, redirectUrl } = InitOAuthSchema.parse(body);

    logger.info('[OAuth API] Initializing OAuth flow', { provider });

    const { authUrl } = await initOAuth(provider, redirectUrl);

    return NextResponse.json({
      success: true,
      authUrl,
      provider,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = createValidationError('Invalid request data');
      const handled = handleError(validationError);
      return NextResponse.json(
        { ...handled, success: false },
        { status: handled.statusCode }
      );
    }
    
    const handled = handleError(error);
    return NextResponse.json(
      { ...handled, success: false },
      { status: handled.statusCode }
    );
  }
}

/**
 * GET /api/auth/oauth?provider=google|github
 * Alternative way to initiate OAuth via GET request (for direct links)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') as 'google' | 'github' | null;
    const redirectUrl = searchParams.get('redirect') || '/';

    if (!provider || !['google', 'github'].includes(provider)) {
      const error = createValidationError('Provider must be "google" or "github"');
      const handled = handleError(error);
      return NextResponse.json(
        { ...handled, success: false },
        { status: handled.statusCode }
      );
    }

    logger.info('[OAuth API] Initializing OAuth flow via GET', { provider });

    const { authUrl } = await initOAuth(provider, redirectUrl);

    // Redirect directly to the OAuth provider
    return NextResponse.redirect(authUrl);

  } catch (error) {
    const handled = handleError(error);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(handled.error || 'oauth_init_failed')}`, request.url)
    );
  }
}
