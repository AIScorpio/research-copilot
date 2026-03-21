// src/lib/daily-digest/config.ts

import { promises as fs } from 'fs';
import { join } from 'path';
import { digestConfigSchema, type DigestConfig } from '@/config/schema/digest';
import { DigestConfigError } from './errors';

// Cache configuration
let cachedConfig: DigestConfig | null = null;
let configLastRead: number = 0;
let configLoadingPromise: Promise<DigestConfig> | null = null;
const CONFIG_CACHE_TTL = 60000; // 1 minute

/**
 * Load and validate digest configuration
 * Implements caching with TTL for performance
 * Uses Promise-based locking to prevent race conditions
 */
export async function loadDigestConfig(): Promise<DigestConfig> {
  const now = Date.now();

  // Return cached config if valid
  if (cachedConfig && (now - configLastRead) < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  // If already loading, wait for that promise
  if (configLoadingPromise) {
    return configLoadingPromise;
  }

  // Start new load operation
  configLoadingPromise = loadConfigInternal();

  try {
    const config = await configLoadingPromise;
    return config;
  } finally {
    // Clear loading promise when done (success or error)
    configLoadingPromise = null;
  }
}

async function loadConfigInternal(): Promise<DigestConfig> {
  try {
    const configPath = join(process.cwd(), 'config', 'digest.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(configData);

    // Validate against Zod schema
    const result = digestConfigSchema.safeParse(parsed);

    if (!result.success) {
      throw new DigestConfigError(
        `Invalid digest configuration: ${result.error.issues.map(e => e.message).join(', ')}`
      );
    }

    cachedConfig = result.data;
    configLastRead = Date.now();

    return cachedConfig;
  } catch (error) {
    if (error instanceof DigestConfigError) throw error;

    throw new DigestConfigError(
      'Failed to load digest configuration. Ensure config/digest.json exists and is valid.'
    );
  }
}

/**
 * Save digest configuration with validation
 */
export async function saveDigestConfig(config: DigestConfig): Promise<void> {
  // Validate before saving
  const result = digestConfigSchema.safeParse(config);
  
  if (!result.success) {
    throw new DigestConfigError(
      `Invalid configuration: ${result.error.issues.map(e => e.message).join(', ')}`
    );
  }
  
  try {
    const configPath = join(process.cwd(), 'config', 'digest.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    // Clear cache to force reload
    cachedConfig = null;
    configLastRead = 0;
  } catch (error) {
    throw new DigestConfigError('Failed to save configuration');
  }
}

/**
 * Clear configuration cache
 */
export function clearDigestConfigCache(): void {
  cachedConfig = null;
  configLastRead = 0;
}
