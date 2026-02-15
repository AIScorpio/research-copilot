/**
 * Auto-Collect API - Updated to use new collection service
 * Supports scheduled daily collection with manual trigger
 */

import { NextResponse } from 'next/server';
import { runAutoCollection } from '@/lib/collection-service';
import { triggerAutoCollection, getSchedulerStatus } from '@/lib/scheduler';
import { handleError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { ensureLLMInitialized } from '@/lib/llm-service';

/**
 * POST /api/auto-collect
 * Trigger auto-collection manually or with override parameters
 */
export async function POST(request: Request) {
    try {
        // Ensure LLM providers are initialized for fallback support
        await ensureLLMInitialized();

        const body = await request.json().catch(() => ({}));
        const { override, trigger } = body;

        // If trigger is true, use the scheduler's trigger function
        if (trigger === true) {
            logger.info('Manual auto-collection trigger received');
            const result = await triggerAutoCollection(override?.query);
            return NextResponse.json(result, {
                status: result.success ? 200 : 500
            });
        }

        // Otherwise, run auto-collection directly
        const result = await runAutoCollection(override?.query);
        
        return NextResponse.json(result, { 
            status: result.success ? 200 : 500 
        });
        
    } catch (error) {
        logger.error('Auto-collect API error', { error });
        const handled = handleError(error);
        return NextResponse.json({ 
            ...handled, 
            success: false 
        }, { status: handled.statusCode });
    }
}

/**
 * GET /api/auto-collect
 * Get scheduler status and last collection results
 */
export async function GET() {
    try {
        const status = getSchedulerStatus();
        
        return NextResponse.json({
            success: true,
            scheduler: status
        });
        
    } catch (error) {
        logger.error('Auto-collect status API error', { error });
        const handled = handleError(error);
        return NextResponse.json({ 
            ...handled, 
            success: false 
        }, { status: handled.statusCode });
    }
}

/**
 * PATCH /api/auto-collect
 * Update scheduler configuration
 */
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { updateSchedulerConfig } = await import('@/lib/scheduler');
        
        updateSchedulerConfig(body);
        
        return NextResponse.json({
            success: true,
            message: 'Scheduler configuration updated'
        });
        
    } catch (error) {
        logger.error('Auto-collect config update error', { error });
        const handled = handleError(error);
        return NextResponse.json({ 
            ...handled, 
            success: false 
        }, { status: handled.statusCode });
    }
}
