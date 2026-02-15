/**
 * Scheduler - Daily auto-collection setup with cron job configuration
 * Can be triggered manually or run automatically
 */

import { runAutoCollection, CollectionResult } from './collection-service';
import { logger } from './logger';

// Scheduler configuration
interface SchedulerConfig {
    enabled: boolean;
    cronExpression: string;
    defaultQuery: string;
    runOnStartup: boolean;
}

// Default configuration
const DEFAULT_CONFIG: SchedulerConfig = {
    enabled: process.env.AUTO_COLLECT_ENABLED === 'true',
    cronExpression: process.env.AUTO_COLLECT_CRON || '0 2 * * *', // 2 AM daily
    defaultQuery: process.env.AUTO_COLLECT_QUERY || 'AI in banking',
    runOnStartup: process.env.AUTO_COLLECT_ON_STARTUP === 'true'
};

// Track scheduler state
let isRunning = false;
let lastRunTime: Date | null = null;
let lastResult: CollectionResult | null = null;
let timeoutId: NodeJS.Timeout | null = null;

/**
 * Initialize the scheduler
 */
export function initializeScheduler(config: Partial<SchedulerConfig> = {}): void {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    
    if (!finalConfig.enabled) {
        logger.info('Auto-collection scheduler is disabled');
        return;
    }
    
    logger.info('Initializing auto-collection scheduler', { 
        cron: finalConfig.cronExpression,
        query: finalConfig.defaultQuery 
    });
    
    // Run on startup if configured
    if (finalConfig.runOnStartup) {
        triggerAutoCollection().catch(err => {
            logger.error('Startup auto-collection failed', { error: err });
        });
    }
    
    // Schedule next run
    scheduleNextRun(finalConfig);
}

/**
 * Trigger auto-collection manually
 */
export async function triggerAutoCollection(query?: string): Promise<CollectionResult> {
    if (isRunning) {
        logger.warn('Auto-collection already in progress, skipping');
        return {
            success: false,
            message: 'Collection already in progress',
            totalFound: 0,
            newCount: 0,
            duplicateCount: 0,
            filteredCount: 0,
            errors: ['Already running'],
            query: query || DEFAULT_CONFIG.defaultQuery,
            papers: [],
            duration: 0
        };
    }
    
    isRunning = true;
    const startTime = new Date();
    
    try {
        logger.info('Starting auto-collection', { query: query || DEFAULT_CONFIG.defaultQuery });
        
        const result = await runAutoCollection(query);
        
        lastRunTime = startTime;
        lastResult = result;
        
        logger.info('Auto-collection completed', { 
            success: result.success,
            newCount: result.newCount,
            duration: result.duration 
        });
        
        return result;
        
    } catch (error) {
        logger.error('Auto-collection failed', { error });
        
        const failedResult: CollectionResult = {
            success: false,
            message: `Auto-collection failed: ${(error as Error).message}`,
            totalFound: 0,
            newCount: 0,
            duplicateCount: 0,
            filteredCount: 0,
            errors: [(error as Error).message],
            query: query || DEFAULT_CONFIG.defaultQuery,
            papers: [],
            duration: Date.now() - startTime.getTime()
        };
        
        lastResult = failedResult;
        return failedResult;
        
    } finally {
        isRunning = false;
    }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
    isRunning: boolean;
    lastRunTime: Date | null;
    lastResult: CollectionResult | null;
    nextRunTime: Date | null;
    config: SchedulerConfig;
} {
    const nextRunTime = timeoutId ? calculateNextRunTime(DEFAULT_CONFIG.cronExpression) : null;
    
    return {
        isRunning,
        lastRunTime,
        lastResult,
        nextRunTime,
        config: DEFAULT_CONFIG
    };
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
    if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
        logger.info('Scheduler stopped');
    }
}

/**
 * Update scheduler configuration
 */
export function updateSchedulerConfig(config: Partial<SchedulerConfig>): void {
    Object.assign(DEFAULT_CONFIG, config);
    
    // Restart scheduler with new config
    stopScheduler();
    if (DEFAULT_CONFIG.enabled) {
        scheduleNextRun(DEFAULT_CONFIG);
    }
    
    logger.info('Scheduler configuration updated', { config: DEFAULT_CONFIG });
}

// Helper functions
function scheduleNextRun(config: SchedulerConfig): void {
    const nextRun = calculateNextRunTime(config.cronExpression);
    const delay = nextRun.getTime() - Date.now();
    
    logger.debug('Scheduling next auto-collection', { 
        nextRun: nextRun.toISOString(),
        delayMs: delay 
    });
    
    timeoutId = setTimeout(async () => {
        await triggerAutoCollection(config.defaultQuery);
        // Schedule next run
        scheduleNextRun(config);
    }, delay);
}

function calculateNextRunTime(cronExpression: string): Date {
    // Simple cron parser for standard daily schedule
    // Format: "minute hour * * *"
    const parts = cronExpression.split(' ');
    
    if (parts.length >= 2) {
        const minute = parseInt(parts[0], 10) || 0;
        const hour = parseInt(parts[1], 10) || 2;
        
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
        
        // If time has passed today, schedule for tomorrow
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }
        
        return next;
    }
    
    // Default to tomorrow at 2 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0);
    return tomorrow;
}

// Export for use in API routes
export { DEFAULT_CONFIG as SCHEDULER_CONFIG };
export type { SchedulerConfig };
