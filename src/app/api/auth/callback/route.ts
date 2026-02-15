import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { 
  getOAuthState, 
  clearOAuthState, 
  completeOAuth,
  OAuthUserProfile 
} from '@/lib/oauth';
import { handleError } from '@/lib/error-handler';
import { generateCSRFToken, setCSRFCookie } from '@/lib/csrf';
import { logger } from '@/lib/logger';

/**
 * OAuth Callback Handler
 * Handles callbacks from Google and GitHub OAuth providers
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors from provider
    if (error) {
      logger.error('[OAuth Callback] Provider returned error', { error, errorDescription });
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      logger.error('[OAuth Callback] Missing code or state parameter');
      return NextResponse.redirect(
        new URL('/login?error=invalid_oauth_response', request.url)
      );
    }

    // Retrieve stored state from cookie
    const storedState = await getOAuthState();
    
    if (!storedState) {
      logger.error('[OAuth Callback] No OAuth state found in cookies');
      return NextResponse.redirect(
        new URL('/login?error=oauth_session_expired', request.url)
      );
    }

    // Clear the OAuth state cookie
    await clearOAuthState();

    // Complete OAuth flow and get user profile
    const { profile, redirectUrl } = await completeOAuth(
      storedState.provider,
      code,
      state,
      storedState
    );

    // Find or create user
    const user = await findOrCreateUser(profile);

    // Set authentication cookies
    await setAuthCookies(user.id);

    logger.info('[OAuth Callback] Authentication successful', { 
      userId: user.id, 
      provider: storedState.provider,
      email: profile.email 
    });

    // Redirect to the originally requested URL or home
    return NextResponse.redirect(new URL(redirectUrl, request.url));

  } catch (error) {
    logger.error('[OAuth Callback] Authentication failed', { error });
    const handled = handleError(error);
    
    // Redirect to login with error
    const errorMessage = handled.error || 'oauth_authentication_failed';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}

/**
 * Find existing user by email or create a new user
 */
async function findOrCreateUser(profile: OAuthUserProfile) {
  // First, try to find user by email
  let user = await prisma.user.findUnique({
    where: { email: profile.email },
  });

  if (user) {
    // User exists - update OAuth info if needed
    // Note: In a production app, you might want to track OAuth accounts separately
    logger.info('[OAuth] Linked to existing user', { userId: user.id, email: profile.email });
    return user;
  }

  // Create new user
  // Generate a random password since OAuth users don't need one
  const randomPassword = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  user = await prisma.user.create({
    data: {
      email: profile.email,
      password: randomPassword, // OAuth users don't use passwords
      // Note: Additional fields like name could be stored if the schema supports it
    },
  });

  logger.info('[OAuth] Created new user', { userId: user.id, email: profile.email });
  
  return user;
}

/**
 * Set authentication cookies
 */
async function setAuthCookies(userId: string): Promise<void> {
  const cookieStore = await cookies();

  // Set auth user cookie
  cookieStore.set('auth_user', userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  // Set CSRF token
  const csrfToken = await generateCSRFToken();
  setCSRFCookie(cookieStore, csrfToken);
}
