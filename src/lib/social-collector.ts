/**
 * Social Media Authentication and Collection
 * Supports Reddit, LinkedIn, Twitter/X, Mastodon
 */

import { prisma } from './db';
import { SearchResult } from './collector';
import { logger } from './logger';

interface SocialAuthConfig {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    scopes?: string[];
}

interface AuthResult {
    authUrl: string;
}

/**
 * Initialize social media source
 * Returns auth URL or error
 */
export async function initSocialSource(sourceId: string, platform: string, authConfig: SocialAuthConfig): Promise<AuthResult> {
    switch (platform) {
        case 'reddit':
            return await initRedditAuth(sourceId, authConfig);
        case 'linkedin':
            return await initLinkedInAuth(sourceId, authConfig);
        case 'twitter':
            return await initTwitterAuth(sourceId, authConfig);
        case 'mastodon':
            return await initMastodonAuth(sourceId, authConfig);
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}

/**
 * Complete OAuth callback
 */
export async function completeOAuth(platform: string, code: string, state: string) {
    switch (platform) {
        case 'reddit':
            return completeRedditOAuth(code, state);
        case 'linkedin':
            return completeLinkedInOAuth(code, state);
        case 'twitter':
            return completeTwitterOAuth(code, state);
        case 'mastodon':
            return completeMastodonOAuth(code, state);
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}

/**
 * Reddit Authentication
 */
async function initRedditAuth(sourceId: string, authConfig: SocialAuthConfig): Promise<AuthResult> {
    // Reddit uses OAuth 2.0
    const authUrl = `https://www.reddit.com/api/v1/authorize?` +
        `client_id=${authConfig.clientId}` +
        `&response_type=code` +
        `&state=${sourceId}` +
        `&redirect_uri=${encodeURIComponent(authConfig.redirectUri || '')}` +
        `&duration=permanent` +
        `&scope=${authConfig.scopes?.join(',') || 'read,history'}`;

    return { authUrl };
}

async function completeRedditOAuth(code: string, state: string): Promise<void> {
    const sourceId = state;

    // Exchange code for access token
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(process.env.REDDIT_CLIENT_ID + ':' + process.env.REDDIT_CLIENT_SECRET).toString('base64')}`,
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.REDDIT_REDIRECT_URI || '',
        }),
    });

    if (!response.ok) {
        throw new Error('Reddit OAuth failed');
    }

    const data = await response.json();

    // Get authenticated user info
    const userResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
        headers: {
            'Authorization': `Bearer ${data.access_token}`,
            'User-Agent': 'InsightFlow/1.0',
        },
    });

    const userData = await userResponse.json();

    // Store credentials
    await prisma.socialCredential.upsert({
        where: { sourceId_platform: { sourceId, platform: 'reddit' } },
        update: {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            username: userData.name,
            expiresAt: new Date(Date.now() + data.expires_in * 1000),
        },
        create: {
            sourceId,
            platform: 'reddit',
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            username: userData.name,
            expiresAt: new Date(Date.now() + data.expires_in * 1000),
        },
    });
}

/**
 * LinkedIn Authentication (placeholder)
 */
async function initLinkedInAuth(sourceId: string, authConfig: SocialAuthConfig): Promise<AuthResult> {
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
        `client_id=${authConfig.clientId}` +
        `&response_type=code` +
        `&state=${sourceId}` +
        `&redirect_uri=${encodeURIComponent(authConfig.redirectUri || '')}` +
        `&scope=${authConfig.scopes?.join(' ') || 'r_liteprofile,r_emailaddress'}`;

    return { authUrl };
}

async function completeLinkedInOAuth(_code: string, _state: string): Promise<void> {
    // LinkedIn OAuth implementation
    // Requires Client Credentials Flow or Authorization Code Flow
    throw new Error('LinkedIn OAuth not yet implemented');
}

/**
 * Twitter/X Authentication (placeholder)
 */
async function initTwitterAuth(sourceId: string, authConfig: SocialAuthConfig): Promise<AuthResult> {
    const authUrl = `https://twitter.com/i/oauth2/authorize?` +
        `client_id=${authConfig.clientId}` +
        `&response_type=code` +
        `&state=${sourceId}` +
        `&redirect_uri=${encodeURIComponent(authConfig.redirectUri || '')}` +
        `&scope=${authConfig.scopes?.join(' ') || 'tweet.read users.read'}` +
        `&code_challenge=challenge` +
        `&code_challenge_method=plain`;

    return { authUrl };
}

async function completeTwitterOAuth(_code: string, _state: string): Promise<void> {
    // Twitter OAuth 2.0 implementation
    throw new Error('Twitter OAuth not yet implemented');
}

/**
 * Mastodon Authentication (placeholder)
 */
async function initMastodonAuth(_sourceId: string, _authConfig: SocialAuthConfig): Promise<AuthResult> {
    // Mastodon instance discovery first
    throw new Error('Mastodon OAuth not yet implemented');
}

async function completeMastodonOAuth(_code: string, _state: string): Promise<void> {
    throw new Error('Mastodon OAuth not yet implemented');
}

/**
 * Get credentials for a source
 */
export async function getSocialCredentials(sourceId: string, platform: string) {
    const creds = await prisma.socialCredential.findUnique({
        where: { sourceId_platform: { sourceId, platform } },
    });

    // Check if token is expired
    if (creds && creds.expiresAt && creds.expiresAt < new Date()) {
        // Refresh token logic here
        if (platform === 'reddit') {
            return await refreshRedditToken(creds);
        }
    }

    return creds;
}

/**
 * Refresh Reddit token
 */
async function refreshRedditToken(creds: any) {
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(process.env.REDDIT_CLIENT_ID + ':' + process.env.REDDIT_CLIENT_SECRET).toString('base64')}`,
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: creds.refreshToken,
        }),
    });

    if (!response.ok) {
        throw new Error('Reddit token refresh failed');
    }

    const data = await response.json();

    return await prisma.socialCredential.update({
        where: { id: creds.id },
        data: {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || creds.refreshToken,
            expiresAt: new Date(Date.now() + data.expires_in * 1000),
        },
    });
}

/**
 * Collect Reddit posts from specific subreddits
 */
export async function collectRedditPosts(subreddits: string[], keywords: string[], limit: number = 10): Promise<SearchResult[]> {
    try {
        const creds = await getSocialCredentials('default', 'reddit');

        if (!creds) {
            logger.warn('Reddit No credentials found, skipping');
            return [];
        }

        const results: SearchResult[] = [];
        
        for (const subreddit of subreddits) {
            const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/hot?limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${creds.accessToken}`,
                    'User-Agent': 'InsightFlow/1.0',
                },
            });

            if (!response.ok) {
                logger.error(`Reddit Failed to fetch from r/${subreddit}`);
                continue;
            }

            const data = await response.json();
            const posts = data.data?.children || [];

            for (const post of posts) {
                const postData = post.data;
                
                // Filter by keywords if provided
                if (keywords.length > 0) {
                    const titleLower = postData.title.toLowerCase();
                    const selftextLower = (postData.selftext || '').toLowerCase();
                    
                    const matchesKeyword = keywords.some(kw => 
                        titleLower.includes(kw.toLowerCase()) || 
                        selftextLower.includes(kw.toLowerCase())
                    );
                    
                    if (!matchesKeyword) continue;
                }

                results.push({
                    title: postData.title,
                    abstract: postData.selftext || postData.url || 'No description',
                    url: `https://reddit.com${postData.permalink}`,
                    source: `Reddit/r/${subreddit}`,
                    publicationDate: new Date(postData.created_utc * 1000),
                });
            }
        }

        return results;
    } catch (error) {
        logger.error('Reddit Collection failed', { error });
        return [];
    }
}

/**
 * Get trending topics from social media
 */
export async function getSocialTrends(keywords: string[], limit: number = 10): Promise<SearchResult[]> {
    try {
        // Default subreddits for banking/tech trends
        const subreddits = [
            'Banking',
            'fintech',
            'FinancialPlanning',
            'investing',
            'CryptoCurrency',
            'MachineLearning',
            'artificial',
            'regulation',
            'finance'
        ];

        const results = await collectRedditPosts(subreddits, keywords, Math.ceil(limit / subreddits.length));
        
        // Sort by date and limit
        return results
            .sort((a, b) => b.publicationDate.getTime() - a.publicationDate.getTime())
            .slice(0, limit);

    } catch (error) {
        logger.error('Social Trends Collection failed', { error });
        return [];
    }
}
