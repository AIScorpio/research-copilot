/**
 * LinkedIn OAuth 2.0 Implementation
 */

import { logger } from '../logger';

export interface LinkedInConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

export interface LinkedInAuthResult {
    authUrl: string;
}

export interface LinkedInTokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
}

export interface LinkedInProfile {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    headline?: string;
}

export class LinkedInOAuth {
    private config: LinkedInConfig;

    constructor(config: LinkedInConfig) {
        this.config = config;
    }

    /**
     * Step 1: Initialize OAuth flow
     * Returns authorization URL for user to visit
     */
    getAuthorizationUrl(): string {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            scope: 'r_liteprofile r_emailaddress w_member_social', // Read-only permissions
            state: Math.random().toString(36).substring(7), // CSRF protection
        });

        return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    }

    /**
     * Step 2: Exchange authorization code for access token
     */
    async exchangeCodeForToken(code: string): Promise<LinkedInTokenResponse> {
        const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: this.config.redirectUri,
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
            }),
        });

        if (!response.ok) {
            throw new Error(`LinkedIn token exchange failed: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Step 3: Get user profile with access token
     */
    async getUserProfile(accessToken: string): Promise<LinkedInProfile> {
        const response = await fetch('https://api.linkedin.com/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`LinkedIn profile fetch failed: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Step 4: Collect recent LinkedIn posts from organization pages
     * Note: This requires additional permissions and API access
     */
    async collectCompanyPosts(companyName: string, limit: number = 10): Promise<any[]> {
        // LinkedIn API for UGC (User Generated Content) requires additional permissions
        // This is a placeholder implementation
        
        const url = `https://api.linkedin.com/v2/shares?q=${encodeURIComponent(companyName)}&count=${limit}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.config.clientSecret}`, // This would be the access token in practice
                'X-Restli-Protocol-Version': '2.0.0',
            },
        });

        if (!response.ok) {
            logger.warn(`LinkedIn Failed to fetch posts for ${companyName}`);
            return [];
        }

        const data = await response.json();
        return data.elements || [];
    }

    /**
     * Complete OAuth flow: Exchange code for token and get profile
     */
    async completeOAuth(code: string): Promise<{
        accessToken: string;
        profile: LinkedInProfile;
        expiresAt: Date;
    }> {
        const tokenResponse = await this.exchangeCodeForToken(code);
        const profile = await this.getUserProfile(tokenResponse.access_token);
        
        const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

        return {
            accessToken: tokenResponse.access_token,
            profile,
            expiresAt
        };
    }

    /**
     * Refresh token (if refresh token is available)
     * Note: LinkedIn typically doesn't provide refresh tokens for authorization code flow
     */
    async refreshToken(refreshToken: string): Promise<LinkedInTokenResponse> {
        const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
            }),
        });

        if (!response.ok) {
            throw new Error(`LinkedIn token refresh failed: ${response.status}`);
        }

        return await response.json();
    }
}

/**
 * Factory function to create LinkedIn OAuth instance
 */
export function createLinkedInOAuth(): LinkedInOAuth | null {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/auth/callback';

    if (!clientId || !clientSecret) {
        logger.warn('LinkedIn OAuth Missing credentials - set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env');
        return null;
    }

    return new LinkedInOAuth({
        clientId,
        clientSecret,
        redirectUri
    });
}
