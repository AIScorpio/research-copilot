import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';

export type AuthIdentity =
    | { type: 'api_key'; name: string }
    | { type: 'session'; userId: string; email: string };

export async function authenticateRequest(request: NextRequest): Promise<AuthIdentity | null> {
    const apiKey = request.headers.get('x-api-key');

    if (apiKey) {
        const validKey = process.env.COPILOT_API_KEY;
        if (!validKey || apiKey !== validKey) {
            return null;
        }
        return { type: 'api_key', name: 'copilot' };
    }

    try {
        const user = await requireAuth();
        if (!user) return null;
        return { type: 'session', userId: user.id, email: user.email };
    } catch {
        return null;
    }
}

export function withApiKeyOrSession(
    handler: (request: NextRequest, identity: AuthIdentity) => Promise<Response>
) {
    return async function(request: NextRequest): Promise<Response> {
        if (request.method === 'OPTIONS') {
            const corsHeaders = {
                'Access-Control-Allow-Origin': process.env.CORS_ALLOWED_ORIGINS || '',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
                'Access-Control-Max-Age': '86400',
            };
            return new NextResponse(null, { status: 204, headers: corsHeaders });
        }

        const identity = await authenticateRequest(request);
        if (!identity) {
            return NextResponse.json(
                { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing credentials' } },
                { status: 401 }
            );
        }

        const response = await handler(request, identity);

        if (identity.type === 'api_key') {
            const corsHeaders = {
                'Access-Control-Allow-Origin': process.env.CORS_ALLOWED_ORIGINS || '',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
            };
            Object.entries(corsHeaders).forEach(([key, value]) => {
                response.headers.set(key, value);
            });
        }

        return response;
    };
}
