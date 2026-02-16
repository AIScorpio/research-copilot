/**
 * Source Type Service
 * Infers and caches source type mappings from database
 */

import { prisma } from './db';
import { getSourceTypeDisplayName } from './source-config';
import { logger } from './logger';

export class SourceTypeService {
  private static cache: Map<string, string> | null = null;
  private static cacheTime: number = 0;
  private static readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Get the display name for a source type based on source name
   * @param sourceName - The source identifier (e.g., "arxiv", "semantic-scholar")
   * @returns The display name (e.g., "Academic", "Industry")
   */
  static async getSourceType(sourceName: string): Promise<string> {
    await this.ensureCache();
    
    const normalized = sourceName.toLowerCase();
    return this.cache?.get(normalized) || 'Internal';
  }

  /**
   * Get source type for multiple sources at once
   */
  static async getSourceTypes(sourceNames: string[]): Promise<Map<string, string>> {
    await this.ensureCache();
    
    const result = new Map<string, string>();
    for (const name of sourceNames) {
      const normalized = name.toLowerCase();
      result.set(name, this.cache?.get(normalized) || 'Internal');
    }
    return result;
  }

  /**
   * Clear the cache (call when sources are updated)
   */
  static clearCache(): void {
    this.cache = null;
    this.cacheTime = 0;
    logger.debug('[SourceTypeService] Cache cleared');
  }

  /**
   * Ensure cache is loaded and fresh
   */
  private static async ensureCache(): Promise<void> {
    const now = Date.now();
    
    if (this.cache && (now - this.cacheTime) < this.CACHE_TTL) {
      return;
    }

    await this.loadCache();
  }

  /**
   * Load cache from database
   */
  private static async loadCache(): Promise<void> {
    try {
      const sources = await prisma.source.findMany({
        select: { 
          name: true, 
          type: true 
        }
      });

      this.cache = new Map();
      
      for (const source of sources) {
        const displayName = await getSourceTypeDisplayName(source.type);
        this.cache.set(source.name.toLowerCase(), displayName);
      }

      this.cacheTime = Date.now();
      
      logger.debug('[SourceTypeService] Cache loaded', { 
        sourceCount: sources.length 
      });
    } catch (error) {
      logger.error('[SourceTypeService] Failed to load cache', { error });
      this.cache = new Map();
    }
  }
}

/**
 * Convenience function to get source type
 */
export async function getSourceType(sourceName: string): Promise<string> {
  return SourceTypeService.getSourceType(sourceName);
}

/**
 * Get the raw source type ID (e.g., "academic", "industry") from source name
 */
export async function inferSourceTypeFromName(sourceName: string): Promise<string> {
  const normalized = sourceName.toLowerCase();
  
  const source = await prisma.source.findUnique({
    where: { name: normalized },
    select: { type: true }
  });
  
  return source?.type || 'internal';
}

/**
 * Convenience function to clear cache
 */
export function clearSourceTypeCache(): void {
  SourceTypeService.clearCache();
}
