/**
 * Groq Models API
 * Fetches available models from Groq API based on user's API key and permissions
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { handleError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';

// GET /api/llm-providers/groq-models - Get available Groq models
export async function GET(request: Request) {
    try {
        await requireAuth();

        const { searchParams } = new URL(request.url);
        const apiKey = searchParams.get('apiKey');

        // If no API key provided, try to get from database or env
        let groqApiKey: string | undefined = apiKey || undefined;
        if (!groqApiKey) {
            // Get the most recent user's Groq config
            const groqConfig = await prisma.userLLMConfig.findFirst({
                where: {
                    provider: { type: 'groq' },
                    isEnabled: true,
                    apiKey: { not: null }
                },
                orderBy: { updatedAt: 'desc' }
            });

            if (groqConfig?.apiKey) {
                groqApiKey = groqConfig.apiKey;
            } else {
                // Fallback to env variable
                groqApiKey = process.env.GROQ_API_KEY;
            }
        }

        if (!groqApiKey) {
            return NextResponse.json({
                success: false,
                models: [],
                count: 0,
                error: 'No Groq API key provided'
            }, { status: 400 });
        }
        
        // Fetch models from Groq API
        const response = await fetch('https://api.groq.com/openai/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorData.error?.message || ''}`);
        }

        const data = await response.json();
        
        // Transform Groq model format to our format
        const models = data.data?.map((model: any) => ({
            externalId: model.id,
            name: formatModelName(model.id),
            contextWindow: model.context_window || 8192,
            capabilities: ['chat'],
            ownedBy: model.owned_by,
            active: model.active,
            created: model.created,
            maxCompletionTokens: model.max_completion_tokens
        })) || [];
        
        // Sort models: active first, then by name
        models.sort((a: any, b: any) => {
            if (a.active !== b.active) return b.active ? 1 : -1;
            return a.name.localeCompare(b.name);
        });

        logger.info(`Fetched ${models.length} Groq models`, { 
            activeModels: models.filter((m: any) => m.active).length 
        });

        return NextResponse.json({
            success: true,
            models,
            count: models.length
        });

    } catch (error) {
        logger.error('Failed to fetch Groq models', { error });
        const handled = handleError(error);
        return NextResponse.json({
            ...handled,
            success: false,
            models: [],
            count: 0
        }, { status: handled.statusCode || 500 });
    }
}

// Format model ID to readable name
function formatModelName(modelId: string): string {
    const nameMap: Record<string, string> = {
        // Llama models
        'llama-3.3-70b-versatile': 'Llama 3.3 70B',
        'llama-3.1-8b-instant': 'Llama 3.1 8B Instant',
        'llama3-8b-8192': 'Llama 3 8B',
        'llama3-70b-8192': 'Llama 3 70B',
        'meta-llama/llama-4-maverick-17b-128e-instruct': 'Llama 4 Maverick 17B',
        'meta-llama/llama-4-scout-17b-16e-instruct': 'Llama 4 Scout 17B',
        // Mixtral
        'mixtral-8x7b-32768': 'Mixtral 8x7B',
        // Gemma
        'gemma2-9b-it': 'Gemma 2 9B',
        // Whisper (Speech-to-text)
        'whisper-large-v3': 'Whisper Large v3',
        'whisper-large-v3-turbo': 'Whisper Large v3 Turbo',
        'distil-whisper-large-v3-en': 'Distil Whisper Large v3 (EN)',
        // Guard models (safety)
        'llama-guard-3-8b': 'Llama Guard 3 8B',
        'meta-llama/llama-guard-4-12b': 'Llama Guard 4 12B',
        'meta-llama/llama-prompt-guard-2-22m': 'Prompt Guard 2 22M',
        'meta-llama/llama-prompt-guard-2-86m': 'Prompt Guard 2 86M',
        // Kimi (Moonshot)
        'moonshotai/kimi-k2-instruct': 'Kimi K2',
        'moonshotai/kimi-k2-instruct-0905': 'Kimi K2 (0905)',
        // Qwen
        'qwen/qwen3-32b': 'Qwen 3 32B',
        // Groq compound
        'groq/compound': 'Groq Compound',
        'groq/compound-mini': 'Groq Compound Mini',
        // OpenAI
        'openai/gpt-oss-20b': 'GPT-OSS 20B',
        'openai/gpt-oss-120b': 'GPT-OSS 120B',
        'openai/gpt-oss-safeguard-20b': 'GPT-OSS Safeguard 20B',
        // Canopy Labs (TTS)
        'canopylabs/orpheus-v1-english': 'Orpheus v1 English',
        'canopylabs/orpheus-arabic-saudi': 'Orpheus Arabic Saudi',
        // Allam
        'allam-2-7b': 'Allam 2 7B'
    };
    
    return nameMap[modelId] || modelId;
}
