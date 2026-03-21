// src/lib/daily-digest/cascade-handler.ts
// Cascade Delete Handler - Manages paper deletion side effects

import { prisma } from '@/lib/db';
import { DigestCascadeError } from './errors';
import type { DigestConfig, DailyDigestLog, Paper } from './types';

/**
 * Digest with papers relation type
 */
type DigestWithPapers = DailyDigestLog & {
  papers: Paper[];
};

/**
 * Digest Cascade Handler
 * Handles cascading updates when papers are deleted
 */
export class DigestCascadeHandler {
  private config: DigestConfig | null = null;
  
  /**
   * Initialize with configuration
   */
  async initialize(): Promise<void> {
    if (!this.config) {
      const { loadDigestConfig } = await import('./config');
      this.config = await loadDigestConfig();
    }
  }
  
  /**
   * Handle paper deletion
   * - Checks if cascade delete is enabled
   * - Removes paper from all associated digests
   * - Updates paper counts
   * - Optionally regenerates affected digests
   */
  async handleDeletion(paperId: string): Promise<void> {
    // Ensure config is loaded
    await this.initialize();
    
    // Check if cascade delete is enabled
    if (!this.config?.cascadeDelete.enabled) {
      console.log(`[CascadeHandler] Cascade delete disabled, skipping paper ${paperId}`);
      return;
    }
    
    try {
      // Find all digests containing this paper
      const affectedDigests = await prisma.dailyDigestLog.findMany({
        where: {
          papers: {
            some: {
              id: paperId
            }
          }
        },
        include: {
          papers: true
        }
      }) as unknown as DigestWithPapers[];
      
      if (affectedDigests.length === 0) {
        console.log(`[CascadeHandler] No digests affected by deletion of paper ${paperId}`);
        return;
      }
      
      console.log(`[CascadeHandler] Processing deletion of paper ${paperId}, affecting ${affectedDigests.length} digests`);
      
      // Process each affected digest
      for (const digest of affectedDigests) {
        await this.updateDigestAfterDeletion(digest, paperId);
      }
      
    } catch (error) {
      console.error(`[CascadeHandler] Failed to handle deletion of paper ${paperId}`, error);
      throw new DigestCascadeError(
        `Failed to process cascade delete for paper ${paperId}`,
        paperId
      );
    }
  }
  
  /**
    * Update digest after paper deletion
    */
  private async updateDigestAfterDeletion(
    digest: DigestWithPapers, 
    deletedPaperId: string
  ): Promise<void> {
    try {
      // Calculate new counts
      const remainingPapers = digest.papers.filter((p: Paper) => p.id !== deletedPaperId);
      const newActualCount = remainingPapers.length;
      
      // Disconnect deleted paper from digest
      await prisma.dailyDigestLog.update({
        where: { id: digest.id },
        data: {
          papers: {
            disconnect: { id: deletedPaperId }
          },
          actualCount: newActualCount,
          updatedAt: new Date()
        }
      });
      
      console.log(`[CascadeHandler] Updated digest ${digest.dateCode}: actualCount ${digest.actualCount} → ${newActualCount}`);
      
      // Check if we should regenerate the digest
      if (this.config && this.config.cascadeDelete.refreshOnDelete && !this.config.cascadeDelete.updateCountOnly) {
        // Trigger regeneration
        console.log(`[CascadeHandler] Triggering regeneration for digest ${digest.dateCode}`);
        await this.triggerRegeneration(digest.dateCode);
      }
      
    } catch (error) {
      console.error(`[CascadeHandler] Failed to update digest ${digest.dateCode}`, error);
      throw error;
    }
  }
  
  /**
   * Trigger digest regeneration
   */
  private async triggerRegeneration(dateCode: string): Promise<void> {
    try {
      // Import engine dynamically to avoid circular dependency
      const { digestEngine } = await import('./engine');
      await digestEngine.regenerateDigest(dateCode);
    } catch (error) {
      console.error(`[CascadeHandler] Failed to regenerate digest ${dateCode}`, error);
      // Don't throw - regeneration failure shouldn't block deletion
    }
  }
  
  /**
   * Batch process deletions with per-paper error handling
   */
  async handleBatchDeletion(paperIds: string[]): Promise<{
    successful: string[];
    failed: Array<{ paperId: string; error: string }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ paperId: string; error: string }> = [];
    
    for (const paperId of paperIds) {
      try {
        await this.handleDeletion(paperId);
        successful.push(paperId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[CascadeHandler] Failed to process paper ${paperId} in batch`, error);
        failed.push({ paperId, error: errorMessage });
        // Continue processing other papers
      }
    }
    
    console.log(`[CascadeHandler] Batch processing complete: ${successful.length} successful, ${failed.length} failed`);
    
    return { successful, failed };
  }
}

// Export singleton instance
export const cascadeHandler = new DigestCascadeHandler();
