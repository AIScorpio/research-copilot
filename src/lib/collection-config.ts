/**
 * Collection Configuration Service
 * Loads and validates collection settings from config/collection.json
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from './logger';

export interface CollectionConfig {
  autoTimeRangeDays: number;
  autoDefaultQuery: string;
  maxResults: number;
  constraints: {
    maxResultsHardLimit: number;
    autoTimeRangeDaysHardLimit: number;
  };
}

// Cached config
let cachedConfig: CollectionConfig | null = null;
let configLastRead: number = 0;
const CONFIG_CACHE_TTL = 60000; // 1 minute cache

/**
 * Default configuration (fallback)
 */
function getDefaultConfig(): CollectionConfig {
  return {
    autoTimeRangeDays: 7,
    autoDefaultQuery: 'AI in banking',
    maxResults: 20,
    constraints: {
      maxResultsHardLimit: 100,
      autoTimeRangeDaysHardLimit: 90
    }
  };
}

/**
 * Load collection configuration from config/collection.json
 */
export async function loadCollectionConfig(): Promise<CollectionConfig> {
  const now = Date.now();
  if (cachedConfig && (now - configLastRead) < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  try {
    const configPath = join(process.cwd(), 'config', 'collection.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    cachedConfig = JSON.parse(configData);
    configLastRead = now;
    
    logger.debug('[CollectionConfig] Loaded config from config/collection.json');
    return cachedConfig!;
  } catch (error) {
    logger.warn('[CollectionConfig] Failed to load config/collection.json, using defaults', { error });
    return getDefaultConfig();
  }
}

/**
 * Save collection configuration to config/collection.json
 */
export async function saveCollectionConfig(config: CollectionConfig): Promise<void> {
  try {
    const configPath = join(process.cwd(), 'config', 'collection.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    // Clear cache to force reload
    cachedConfig = null;
    configLastRead = 0;
    
    logger.info('[CollectionConfig] Saved config to config/collection.json');
  } catch (error) {
    logger.error('[CollectionConfig] Failed to save config/collection.json', { error });
    throw error;
  }
}

/**
 * Validate configuration values against constraints
 */
export function validateConfig(config: Partial<CollectionConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const defaultConfig = getDefaultConfig();

  // Validate autoTimeRangeDays
  if (config.autoTimeRangeDays !== undefined) {
    const hardLimit = config.constraints?.autoTimeRangeDaysHardLimit || defaultConfig.constraints.autoTimeRangeDaysHardLimit;
    if (config.autoTimeRangeDays < 1 || config.autoTimeRangeDays > hardLimit) {
      errors.push(`autoTimeRangeDays must be between 1 and ${hardLimit}`);
    }
  }

  // Validate maxResults
  if (config.maxResults !== undefined) {
    const hardLimit = config.constraints?.maxResultsHardLimit || defaultConfig.constraints.maxResultsHardLimit;
    if (config.maxResults < 1 || config.maxResults > hardLimit) {
      errors.push(`maxResults must be between 1 and ${hardLimit}`);
    }
  }

  // Validate autoDefaultQuery
  if (config.autoDefaultQuery !== undefined) {
    if (typeof config.autoDefaultQuery !== 'string' || config.autoDefaultQuery.trim().length === 0) {
      errors.push('autoDefaultQuery must be a non-empty string');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Clear config cache (for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  configLastRead = 0;
}
