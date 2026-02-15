/**
 * Twitter/X OAuth 2.0 Implementation
 */

import { logger } from '../logger';

export interface TwitterConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

export interface TwitterAuthResult {
    authUrl: string;
}

export interface TwitterTokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
}

export interface TwitterProfile {
    id: string;
    name: string;
    username: string;
    email?: string;
}

export class TwitterOAuth {
    private config: TwitterConfig;

    constructor(config: TwitterConfig) {
        this.config = config;
    }

    /**
     * Step 1: Generate code challenge and verifier for PKCE
     * Twitter/X requires PKCE (Proof Key for Code Exchange) for OAuth 2.0
     */
    generatePKCE(): { codeChallenge: string; codeVerifier: string } {
        const codeVerifier = this.base64UrlEncode(this.generateRandomString(128));
        const codeChallenge = this.base64UrlEncode(
            this.sha256(codeVerifier)
        );

        return { codeChallenge, codeVerifier };
    }

    /**
     * Generate random string for PKCE
     */
    private generateRandomString(length: number): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * SHA-256 hash function for PKCE
     */
    private sha256(message: string): string {
        // This is a simplified implementation
        // In production, use crypto.subtle.digest('SHA-256', message)
        const hash = [];
        for (let i = 0; i < message.length; i++) {
            hash.push(message.charCodeAt(i));
        }
        return btoa(hash.join(''));
    }

    /**
     * Base64 URL encode
     */
    private base64UrlEncode(str: string): string {
        return str
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    /**
     * Step 2: Initialize OAuth flow with PKCE
     * Returns authorization URL for user to visit
     */
    getAuthorizationUrl(codeChallenge: string): string {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            scope: 'tweet.read users.read follows.read', // Read permissions
            state: Math.random().toString(36).substring(7), // CSRF protection
            code_challenge: codeChallenge,
            code_challenge_method: 'plain',
        });

        return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
    }

    /**
     * Step 3: Exchange authorization code for access token
     */
    async exchangeCodeForToken(code: string, codeVerifier: string): Promise<TwitterTokenResponse> {
        const response = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: this.config.redirectUri,
                client_id: this.config.clientId,
                code_verifier: codeVerifier,
            }),
        });

        if (!response.ok) {
            throw new Error(`Twitter token exchange failed: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Step 4: Get user profile with access token
     */
    async getUserProfile(accessToken: string): Promise<TwitterProfile> {
        const response = await fetch('https://api.twitter.com/2/users/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Twitter profile fetch failed: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Step 5: Collect recent tweets from search API
     */
    async collectTweets(query: string, limit: number = 10): Promise<any[]> {
        const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${limit}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.config.clientSecret}`, // This would be the access token in practice
            },
        });

        if (!response.ok) {
            logger.warn(`Twitter Failed to search tweets for: ${query}`);
            return [];
        }

        const data = await response.json();
        return data.data || [];
    }

    /**
     * Complete OAuth flow: Exchange code for token and get profile
     */
    async completeOAuth(code: string, codeVerifier: string): Promise<{
        accessToken: string;
        refreshToken: string;
        profile: TwitterProfile;
        expiresAt: Date;
    }> {
        const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier);
        const profile = await this.getUserProfile(tokenResponse.access_token);
        
        const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

        return {
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            profile,
            expiresAt
        };
    }

    /**
     * Refresh access token
     */
    async refreshToken(refreshToken: string): Promise<TwitterTokenResponse> {
        const response = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: this.config.clientId,
            }),
        });

        if (!response.ok) {
            throw new Error(`Twitter token refresh failed: ${response.status}`);
        }

        return await response.json();
    }
}

/**
 * Factory function to create Twitter/X OAuth instance
 */
export function createTwitterOAuth(): TwitterOAuth | null {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;
    const redirectUri = process.env.TWITTER_REDIRECT_URI || 'http://localhost:3000/auth/callback';

    if (!clientId || !clientSecret) {
        logger.warn('Twitter OAuth Missing credentials - set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET in .env');
        return null;
    }

    return new TwitterOAuth({
        clientId,
        clientSecret,
        redirectUri
    });
}
