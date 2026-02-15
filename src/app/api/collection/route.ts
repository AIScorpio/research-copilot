/**
 * Collection API - Updated to use new collection service
 * Supports auto and manual modes with LLM-powered features
 */

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { 
    runCollection, 
    runAutoCollection, 
    runPipelineCollection,
    CollectionOptions 
} from '@/lib/collection-service';
import { handleError, createValidationError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

// Validation schema for collection request
const CollectionSchema = z.object({
    mode: z.enum(['auto', 'manual', 'pipeline']).default('manual'),
    query: z.string().min(1).max(500).optional(),
    horizon: z.enum(['today', 'week', 'month', 'year', 'custom']).optional(),
    dateFrom: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/).optional(),
    dateTo: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/).optional(),
    useLLMOptimization: z.boolean().optional(),
    useLLMFiltering: z.boolean().optional(),
    queryStrictness: z.enum(['relaxed', 'balanced', 'strict']).optional(),
    maxResults: z.number().min(1).max(500).optional(),
    minRelevanceScore: z.number().min(0).max(100).optional(),
    sources: z.array(z.string()).optional(),
    focusAreas: z.array(z.string()).optional()
});

/**
 * POST /api/collection
 * Main collection endpoint supporting multiple modes
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // Validate input
        const validationResult = CollectionSchema.safeParse(body);
        if (!validationResult.success) {
            const error = createValidationError('Invalid input', { 
                details: validationResult.error.issues 
            });
            const handled = handleError(error);
            return NextResponse.json({ ...handled, success: false }, { status: handled.statusCode });
        }
        
        const data = validationResult.data;
        
        logger.info('Collection API called', { mode: data.mode, query: data.query });
        
        // Build collection options
        const options: CollectionOptions = {
            mode: data.mode,
            query: data.query,
            horizon: data.horizon,
            dateFrom: data.dateFrom,
            dateTo: data.dateTo,
            useLLMOptimization: data.useLLMOptimization,
            useLLMFiltering: data.useLLMFiltering,
            queryStrictness: data.queryStrictness,
            maxResults: data.maxResults,
            minRelevanceScore: data.minRelevanceScore,
            sources: data.sources,
            focusAreas: data.focusAreas
        };
        
        // Run collection based on mode
        let result;
        switch (data.mode) {
            case 'auto':
                result = await runAutoCollection(data.query);
                break;
            case 'pipeline':
                result = await runPipelineCollection(data.query || 'AI in banking', options);
                break;
            case 'manual':
            default:
                result = await runCollection(options);
                break;
        }
        
        // Revalidate paths if new papers were added
        if (result.newCount > 0) {
            revalidatePath('/');
            revalidatePath('/papers');
        }
        
        return NextResponse.json(result, { 
            status: result.success ? 200 : 500 
        });
        
    } catch (error) {
        logger.error('Collection API error', { error });
        const handled = handleError(error);
        return NextResponse.json({ 
            ...handled, 
            success: false 
        }, { status: handled.statusCode });
    }
}

/**
 * GET /api/collection
 * Get collection statistics and status
 */
export async function GET() {
    try {
        const { getCollectionStats } = await import('@/lib/collection-service');
        const stats = await getCollectionStats();
        
        return NextResponse.json({
            success: true,
            stats
        });
        
    } catch (error) {
        logger.error('Collection stats API error', { error });
        const handled = handleError(error);
        return NextResponse.json({ 
            ...handled, 
            success: false 
        }, { status: handled.statusCode });
    }
}
