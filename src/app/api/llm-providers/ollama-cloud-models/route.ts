/**
 * Ollama Cloud Models API
 * Fetches available models from Ollama Cloud based on user's API key
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { handleError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';

// GET /api/llm-providers/ollama-cloud-models - Get available Ollama Cloud models
export async function GET(request: Request) {
    try {
        await requireAuth();

        const { searchParams } = new URL(request.url);
        const apiKey = searchParams.get('apiKey');

        // If no API key provided, try to get from database or env
        let ollamaApiKey: string | undefined = apiKey || undefined;
        if (!ollamaApiKey) {
            // Get the most recent user's ollama-cloud config
            const ollamaConfig = await prisma.userLLMConfig.findFirst({
                where: {
                    provider: { type: 'ollama-cloud' },
                    isEnabled: true,
                    apiKey: { not: null }
                },
                orderBy: { updatedAt: 'desc' }
            });

            if (ollamaConfig?.apiKey) {
                ollamaApiKey = ollamaConfig.apiKey;
            } else {
                // Fallback to env variable
                ollamaApiKey = process.env.OLLAMA_API_KEY;
            }
        }

        if (!ollamaApiKey) {
            return NextResponse.json({
                success: false,
                models: [],
                count: 0,
                error: 'No Ollama API key provided'
            }, { status: 400 });
        }
        
        // Fetch models from Ollama Cloud API
        const response = await fetch('https://ollama.com/api/tags', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${ollamaApiKey}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Ollama Cloud API error: ${response.status} ${response.statusText} - ${errorData.error?.message || ''}`);
        }

        const data = await response.json();
        
        // Transform Ollama model format to our format
        // Note: Ollama Cloud API returns all models without -cloud suffix
        const models = data.models?.map((model: any) => ({
            externalId: model.name,
            name: model.name,
            contextWindow: 128000,
            capabilities: ['chat'],
            size: model.size,
            modified: model.modified
        })) || [];

        logger.info(`Fetched ${models.length} Ollama Cloud models`);

        return NextResponse.json({
            success: true,
            models,
            count: models.length
        });

    } catch (error) {
        logger.error('Failed to fetch Ollama Cloud models', { error });
        const handled = handleError(error);
        return NextResponse.json({
            ...handled,
            success: false,
            models: [],
            count: 0
        }, { status: handled.statusCode || 500 });
    }
}
