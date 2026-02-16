/**
 * LLM Init API - Server-side LLM initialization endpoint
 * Called by client to ensure LLM providers are loaded
 */

import { NextResponse } from 'next/server';
import { ensureLLMInitialized, reinitializeLLMFromDatabase } from '@/lib/llm-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/llm-init
 * Initialize or reinitialize LLM providers
 */
export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const force = searchParams.get('force') === 'true';

        if (force) {
            // Force reinitialization (e.g., after model change)
            await reinitializeLLMFromDatabase('system');
            return NextResponse.json({ success: true, message: 'LLM reinitialized' });
        } else {
            // Normal initialization (idempotent)
            await ensureLLMInitialized('system');
            return NextResponse.json({ success: true, message: 'LLM initialized' });
        }
    } catch (error) {
        logger.warn('LLM init API failed', { error });
        // Return success anyway - collection API will retry
        return NextResponse.json({ success: true, message: 'Will retry on collection' });
    }
}
