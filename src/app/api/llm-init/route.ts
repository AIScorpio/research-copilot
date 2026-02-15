/**
 * LLM Init API - Server-side LLM initialization endpoint
 * Called by client to ensure LLM providers are loaded
 */

import { NextResponse } from 'next/server';
import { ensureLLMInitialized } from '@/lib/llm-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/llm-init
 * Initialize LLM providers (idempotent)
 */
export async function POST() {
    try {
        await ensureLLMInitialized('system');
        return NextResponse.json({ success: true, message: 'LLM initialized' });
    } catch (error) {
        logger.warn('LLM init API failed', { error });
        // Return success anyway - collection API will retry
        return NextResponse.json({ success: true, message: 'Will retry on collection' });
    }
}
