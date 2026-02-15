/**
 * Ollama Models API
 * Fetches available models from local Ollama instance
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { handleError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

// GET /api/llm-providers/ollama-models - Get available Ollama models
export async function GET(request: Request) {
    try {
        await requireAuth();
        
        const { searchParams } = new URL(request.url);
        const baseUrl = searchParams.get('baseUrl') || 'http://localhost:11434';
        
        // Fetch models from Ollama API
        const response = await fetch(`${baseUrl}/api/tags`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Transform Ollama model format to our format
        const models = data.models?.map((model: any) => ({
            externalId: model.name,
            name: model.name,
            contextWindow: 128000, // Default, could be improved by reading model details
            capabilities: ['chat'],
            size: model.size,
            modified: model.modified
        })) || [];

        logger.info(`Fetched ${models.length} Ollama models from ${baseUrl}`);

        return NextResponse.json({
            success: true,
            models,
            count: models.length
        });

    } catch (error) {
        logger.error('Failed to fetch Ollama models', { error });
        const handled = handleError(error);
        return NextResponse.json({
            ...handled,
            success: false,
            models: [],
            count: 0
        }, { status: handled.statusCode || 500 });
    }
}
