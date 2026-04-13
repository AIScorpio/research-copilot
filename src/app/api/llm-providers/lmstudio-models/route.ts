import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { handleError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
    try {
        await requireAuth();

        const { searchParams } = new URL(request.url);
        const baseUrl = searchParams.get('baseUrl') || 'http://localhost:1234';

        const response = await fetch(`${baseUrl}/v1/models`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        const models = data.data?.map((model: any) => ({
            externalId: model.id,
            name: model.id,
            contextWindow: model.context_length || 4096,
            capabilities: ['chat'],
        })) || [];

        logger.info(`Fetched ${models.length} LM Studio models from ${baseUrl}`);

        return NextResponse.json({
            success: true,
            models,
            count: models.length
        });

    } catch (error) {
        logger.error('Failed to fetch LM Studio models', { error });
        const handled = handleError(error);
        return NextResponse.json({
            ...handled,
            success: false,
            models: [],
            count: 0
        }, { status: handled.statusCode || 500 });
    }
}
