/**
 * Collection Settings API
 * GET/POST /api/settings/collection
 */

import { NextResponse } from 'next/server';
import { loadCollectionConfig, saveCollectionConfig, validateConfig, CollectionConfig } from '@/lib/collection-config';
import { logger } from '@/lib/logger';

/**
 * GET /api/settings/collection
 * Load current collection configuration
 */
export async function GET() {
    try {
        const config = await loadCollectionConfig();
        
        return NextResponse.json({
            success: true,
            config
        });
    } catch (error) {
        logger.error('Failed to load collection config', { error });
        return NextResponse.json(
            { success: false, message: 'Failed to load collection configuration' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/settings/collection
 * Save collection configuration
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // Load current config to get constraints
        const currentConfig = await loadCollectionConfig();
        
        // Build new config with constraints preserved
        const newConfig: CollectionConfig = {
            autoTimeRangeDays: body.autoTimeRangeDays ?? currentConfig.autoTimeRangeDays,
            autoDefaultQuery: body.autoDefaultQuery ?? currentConfig.autoDefaultQuery,
            maxResults: body.maxResults ?? currentConfig.maxResults,
            constraints: currentConfig.constraints // Constraints are read-only
        };
        
        // Validate
        const validation = validateConfig(newConfig);
        if (!validation.valid) {
            return NextResponse.json(
                { success: false, message: 'Validation failed', errors: validation.errors },
                { status: 400 }
            );
        }
        
        // Save
        await saveCollectionConfig(newConfig);
        
        logger.info('Collection config saved', { config: newConfig });
        
        return NextResponse.json({
            success: true,
            message: 'Collection settings saved successfully',
            config: newConfig
        });
    } catch (error) {
        logger.error('Failed to save collection config', { error });
        return NextResponse.json(
            { success: false, message: 'Failed to save collection configuration' },
            { status: 500 }
        );
    }
}
