/**
 * OAuth 2.0 Implementation for Google and GitHub Social Login
 */

import { cookies } from 'next/headers';
import { logger } from './logger';

// ============================================================================
// Types
// ============================================================================

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OAuthUserProfile {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  provider: 'google' | 'github';
}

export interface OAuthTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  token_type: string;
}

export interface OAuthState {
  provider: 'google' | 'github';
  state: string;
  codeVerifier?: string;
  redirectUrl: string;
}

// ============================================================================
// Google OAuth
// ============================================================================

export class GoogleOAuth {
  private config: OAuthConfig;

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  /**
   * Generate OAuth state parameter for CSRF protection
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const array = new Uint8Array(128);
    crypto.getRandomValues(array);
    const codeVerifier = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    
    // Generate code challenge (SHA256 of verifier, base64url encoded)
    const codeChallenge = btoa(codeVerifier)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    return { codeVerifier, codeChallenge };
  }

  /**
   * Initialize Google OAuth flow
   * Returns authorization URL and stores state in cookies
   */
  async initAuth(redirectUrl: string = '/'): Promise<{ authUrl: string; state: string }> {
    const state = this.generateState();
    const { codeVerifier, codeChallenge } = this.generatePKCE();

    // Store state in cookie for verification
    const cookieStore = await cookies();
    cookieStore.set('oauth_state', JSON.stringify({
      provider: 'google',
      state,
      codeVerifier,
      redirectUrl,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    
    logger.info('[OAuth] Initialized Google OAuth flow');
    
    return { authUrl, state };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, codeVerifier: string): Promise<OAuthTokenResponse> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('[OAuth] Google token exchange failed', { error, status: response.status });
      throw new Error(`Google token exchange failed: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Get user profile from Google
   */
  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('[OAuth] Google profile fetch failed', { error, status: response.status });
      throw new Error(`Google profile fetch failed: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      picture: data.picture,
      provider: 'google',
    };
  }
}

// ============================================================================
// GitHub OAuth
// ============================================================================

export class GitHubOAuth {
  private config: OAuthConfig;

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  /**
   * Generate OAuth state parameter for CSRF protection
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Initialize GitHub OAuth flow
   * Returns authorization URL and stores state in cookies
   */
  async initAuth(redirectUrl: string = '/'): Promise<{ authUrl: string; state: string }> {
    const state = this.generateState();

    // Store state in cookie for verification
    const cookieStore = await cookies();
    cookieStore.set('oauth_state', JSON.stringify({
      provider: 'github',
      state,
      redirectUrl,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: 'user:email read:user',
      state,
    });

    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
    
    logger.info('[OAuth] Initialized GitHub OAuth flow');
    
    return { authUrl, state };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('[OAuth] GitHub token exchange failed', { error, status: response.status });
      throw new Error(`GitHub token exchange failed: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Get user profile from GitHub
   */
  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      const error = await userResponse.text();
      logger.error('[OAuth] GitHub profile fetch failed', { error, status: userResponse.status });
      throw new Error(`GitHub profile fetch failed: ${userResponse.status}`);
    }

    const userData = await userResponse.json();

    // Get primary email
    let email = userData.email;
    if (!email) {
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (emailResponse.ok) {
        const emails = await emailResponse.json();
        const primaryEmail = emails.find((e: any) => e.primary && e.verified);
        if (primaryEmail) {
          email = primaryEmail.email;
        } else {
          const verifiedEmail = emails.find((e: any) => e.verified);
          if (verifiedEmail) {
            email = verifiedEmail.email;
          }
        }
      }
    }

    if (!email) {
      throw new Error('GitHub account does not have a verified email address');
    }

    return {
      id: userData.id.toString(),
      email,
      name: userData.name || userData.login,
      picture: userData.avatar_url,
      provider: 'github',
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createGoogleOAuth(): GoogleOAuth | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/callback`;

  if (!clientId || !clientSecret) {
    logger.warn('[OAuth] Google OAuth credentials not configured');
    return null;
  }

  return new GoogleOAuth({ clientId, clientSecret, redirectUri });
}

export function createGitHubOAuth(): GitHubOAuth | null {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/callback`;

  if (!clientId || !clientSecret) {
    logger.warn('[OAuth] GitHub OAuth credentials not configured');
    return null;
  }

  return new GitHubOAuth({ clientId, clientSecret, redirectUri });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get stored OAuth state from cookies
 */
export async function getOAuthState(): Promise<OAuthState | null> {
  try {
    const cookieStore = await cookies();
    const stateCookie = cookieStore.get('oauth_state');
    
    if (!stateCookie?.value) {
      return null;
    }

    return JSON.parse(stateCookie.value) as OAuthState;
  } catch (error) {
    logger.error('[OAuth] Failed to parse OAuth state', { error });
    return null;
  }
}

/**
 * Clear OAuth state cookie
 */
export async function clearOAuthState(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('oauth_state');
}

/**
 * Initialize OAuth flow based on provider
 */
export async function initOAuth(
  provider: 'google' | 'github',
  redirectUrl: string = '/'
): Promise<{ authUrl: string }> {
  if (provider === 'google') {
    const googleOAuth = createGoogleOAuth();
    if (!googleOAuth) {
      throw new Error('Google OAuth is not configured');
    }
    const { authUrl } = await googleOAuth.initAuth(redirectUrl);
    return { authUrl };
  } else {
    const githubOAuth = createGitHubOAuth();
    if (!githubOAuth) {
      throw new Error('GitHub OAuth is not configured');
    }
    const { authUrl } = await githubOAuth.initAuth(redirectUrl);
    return { authUrl };
  }
}

/**
 * Complete OAuth flow and get user profile
 */
export async function completeOAuth(
  provider: 'google' | 'github',
  code: string,
  state: string,
  storedState: OAuthState
): Promise<{ profile: OAuthUserProfile; redirectUrl: string }> {
  // Verify state matches
  if (state !== storedState.state) {
    throw new Error('Invalid OAuth state parameter');
  }

  if (provider === 'google') {
    const googleOAuth = createGoogleOAuth();
    if (!googleOAuth) {
      throw new Error('Google OAuth is not configured');
    }

    const tokenResponse = await googleOAuth.exchangeCodeForToken(
      code,
      storedState.codeVerifier!
    );
    const profile = await googleOAuth.getUserProfile(tokenResponse.access_token);
    
    return { profile, redirectUrl: storedState.redirectUrl };
  } else {
    const githubOAuth = createGitHubOAuth();
    if (!githubOAuth) {
      throw new Error('GitHub OAuth is not configured');
    }

    const tokenResponse = await githubOAuth.exchangeCodeForToken(code);
    const profile = await githubOAuth.getUserProfile(tokenResponse.access_token);
    
    return { profile, redirectUrl: storedState.redirectUrl };
  }
}
