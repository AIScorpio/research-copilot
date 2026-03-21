// src/lib/daily-digest/engine.ts
// Daily Intelligence Digest Engine - Core service implementation

import { prisma } from '@/lib/db';
import { loadDigestConfig } from './config';
import { DigestGenerator } from './generator';
import { DigestValidator } from './validator';
import { DigestCascadeHandler } from './cascade-handler';
import { DigestGenerationError } from './errors';
import type { 
  DailyDigestLog, 
  DigestResult, 
  ValidationReport,
  Paper,
  PaperTag,
  DigestConfig,
  GeneratedContent
} from './types';

/**
 * Prisma DailyDigestLog with papers relation
 */
type DigestWithPapers = DailyDigestLog & {
  papers: Paper[];
};

/**
 * Daily Digest Engine Interface
 * Core contract for digest generation and management
 */
export interface DailyDigestEngine {
  triggerDailyDigestUpdate(date?: Date): Promise<DigestResult>;
  regenerateDigest(dateCode: string): Promise<DigestResult>;
  getOrCreateDigest(dateCode: string): Promise<DailyDigestLog>;
  cleanupDeletedPapers(paperId: string): Promise<void>;
}

/**
 * Digest Engine Implementation
 * Handles digest generation with validation, retries, and distributed locking
 */
export class DigestEngineImpl implements DailyDigestEngine {
  private generator: DigestGenerator;
  private validator: DigestValidator;
  private cascadeHandler: DigestCascadeHandler;
  private generationLocks: Map<string, Promise<DigestResult>> = new Map();
  
  constructor() {
    this.generator = new DigestGenerator();
    this.validator = new DigestValidator();
    this.cascadeHandler = new DigestCascadeHandler();
  }
  
  /**
   * Trigger digest update for a specific date
   * Implements distributed locking to prevent concurrent generation
   */
  async triggerDailyDigestUpdate(date?: Date): Promise<DigestResult> {
    const targetDate = date || new Date();
    const dateCode = targetDate.toISOString().split('T')[0];
    
    // Check if generation already in progress for this date
    const existingLock = this.generationLocks.get(dateCode);
    if (existingLock) {
      console.log(`[DigestEngine] Generation already in progress for ${dateCode}, waiting...`);
      return existingLock;
    }
    
    // Check if digest already exists (database-level deduplication)
    const existingDigest = await prisma.dailyDigestLog.findUnique({
      where: { dateCode },
      include: { papers: true }
    });
    
    // Check current paper count for this date
    const [year, month, day] = dateCode.split('-').map(Number);
    const startDate = new Date(year, month - 1, day, 0, 0, 0);
    const endDate = new Date(year, month - 1, day + 1, 0, 0, 0);
    
    const currentPaperCount = await prisma.paper.count({
      where: {
        collectedAt: {
          gte: startDate,
          lt: endDate
        },
        deletedAt: null
      }
    });
    
    // If digest exists and paper count matches, return existing
    if (existingDigest && existingDigest.status !== 'error') {
      if (currentPaperCount === existingDigest.actualCount) {
        console.log(`[DigestEngine] Digest already exists for ${dateCode} with ${currentPaperCount} papers, returning existing`);
        return {
          success: true,
          digest: this.mapPrismaDigestToType(existingDigest),
          retries: 0
        };
      }
      
      // Paper count changed, need to regenerate
      console.log(`[DigestEngine] Paper count changed for ${dateCode}: ${existingDigest.actualCount} -> ${currentPaperCount}, regenerating...`);
    }
    
    // Edge Case: No papers for this date - delete existing digest if any
    if (currentPaperCount === 0) {
      if (existingDigest) {
        await prisma.dailyDigestLog.delete({ where: { dateCode } });
        console.log(`[DigestEngine] Deleted stale digest for ${dateCode} - no papers remain`);
      }
      return {
        success: false,
        error: new Error(`No papers found for ${dateCode}`),
        retries: 0
      };
    }
    
    console.log(`[DigestEngine] Triggering digest update for ${dateCode}`);
    
    // Distributed lock check (database-level for multi-instance deployments)
    const lockAcquired = await this.acquireDistributedLock(dateCode);
    if (!lockAcquired) {
      console.log(`[DigestEngine] Generation already in progress for ${dateCode} (distributed lock)`);
      // Wait a bit and return existing digest
      await new Promise(resolve => setTimeout(resolve, 1000));
      const existingDigest = await prisma.dailyDigestLog.findUnique({
        where: { dateCode },
        include: { papers: true }
      });
      if (existingDigest) {
        return {
          success: true,
          digest: this.mapPrismaDigestToType(existingDigest),
          retries: 0
        };
      }
      return {
        success: false,
        error: new Error('Failed to retrieve existing digest'),
        retries: 0
      };
    }
    
    // Create generation promise and store in locks
    const generationPromise = this.executeGeneration(dateCode);
    this.generationLocks.set(dateCode, generationPromise);
    
    try {
      const result = await generationPromise;
      return result;
    } finally {
      // Always clean up the locks
      this.generationLocks.delete(dateCode);
      await this.releaseDistributedLock(dateCode).catch(err => 
        console.error(`[DigestEngine] Failed to release distributed lock for ${dateCode}`, err)
      );
    }
  }
  
  /**
   * Acquire distributed lock using database
   * Prevents concurrent generation across multiple server instances
   * FAILS CLOSED - returns false on error to prevent race conditions
   */
  private async acquireDistributedLock(dateCode: string, ttlSeconds = 60): Promise<boolean> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
      
      // Try to create a new lock
      try {
        await prisma.digestGenerationLock.create({
          data: {
            dateCode,
            lockedAt: now,
            expiresAt
          }
        });
        return true;
      } catch {
        // Lock already exists, check if expired
        const existingLock = await prisma.digestGenerationLock.findUnique({
          where: { dateCode }
        });
        
        if (existingLock && existingLock.expiresAt < now) {
          // Lock expired, update it
          await prisma.digestGenerationLock.update({
            where: { dateCode },
            data: { lockedAt: now, expiresAt }
          });
          return true;
        }
        
        return false;
      }
    } catch (error) {
      console.error(`[DigestEngine] Failed to acquire distributed lock for ${dateCode}`, error);
      // FAIL CLOSED - prevent generation if lock fails
      return false;
    }
  }
  
  /**
   * Release distributed lock
   */
  private async releaseDistributedLock(dateCode: string): Promise<void> {
    try {
      await prisma.digestGenerationLock.delete({
        where: { dateCode }
      });
    } catch (error) {
      console.error(`[DigestEngine] Failed to release distributed lock for ${dateCode}`, error);
    }
  }
  
  /**
   * Execute the actual digest generation with validation and retry logic
   */
  private async executeGeneration(dateCode: string): Promise<DigestResult> {
    try {
      // 1. Load configuration
      const config = await loadDigestConfig();
      
      // 2. Query papers for this date
      const papers = await this.fetchPapersForDate(dateCode);
      
      if (papers.length === 0) {
        console.log(`[DigestEngine] No papers found for ${dateCode}`);
        return { success: true, retries: 0 };
      }
      
      // 3. Generate digest with validation and retry logic
      return await this.generateWithValidation(papers, dateCode, config);
      
    } catch (error) {
      console.error(`[DigestEngine] Failed to update digest for ${dateCode}`, error);
      
      // Try to update digest status to error (best effort)
      try {
        await prisma.dailyDigestLog.update({
          where: { dateCode },
          data: { 
            status: 'error',
            updatedAt: new Date()
          }
        });
      } catch {
        // Ignore update errors - digest might not exist
      }
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        retries: 0
      };
    }
  }
  
  /**
   * Fetch papers for a specific date
   * Automatically excludes deleted papers
   */
  private async fetchPapersForDate(dateCode: string): Promise<Paper[]> {
    // Parse dateCode and create local date range
    const [year, month, day] = dateCode.split('-').map(Number);
    const startDate = new Date(year, month - 1, day, 0, 0, 0); // Local time 00:00:00
    const endDate = new Date(year, month - 1, day + 1, 0, 0, 0); // Local time next day 00:00:00
    
    console.log(`[DigestEngine] Fetching papers from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const papers = await prisma.paper.findMany({
      where: {
        collectedAt: {
          gte: startDate,
          lt: endDate
        },
        deletedAt: null // Exclude deleted papers
      },
      include: {
        tags: {
          include: {
            tag: true
          }
        }
      }
    });
    
    return this.mapPrismaPapersToType(papers);
  }
  
  /**
   * Generate digest with validation and retry logic
   */
  private async generateWithValidation(
    papers: Paper[], 
    dateCode: string, 
    config: DigestConfig
  ): Promise<DigestResult> {
    // Skip validation if disabled
    if (!config.quality.validationEnabled) {
      console.log(`[DigestEngine] Validation disabled, generating without validation`);
      const generated = await this.generator.generate(papers, dateCode, config);
      const digest = await this.saveDigest(dateCode, generated, null, papers);
      return {
        success: true,
        digest,
        retries: 0
      };
    }
    
    let attempt = 0;
    const maxAttempts = config.quality.retry.maxAttempts;
    
    while (attempt < maxAttempts) {
      attempt++;
      console.log(`[DigestEngine] Generation attempt ${attempt}/${maxAttempts} for ${dateCode}`);
      
      try {
        // Generate content
        const generated = await this.generator.generate(papers, dateCode, config);
        
        // Validate content
        const validationReport = await this.validator.validate(generated, papers, config);
        
        if (validationReport.passed) {
          // Validation passed - save digest
          const digest = await this.saveDigest(dateCode, generated, validationReport, papers);
          
          return {
            success: true,
            digest,
            validation: validationReport,
            retries: attempt - 1
          };
        }
        
        // Validation failed - check if we should retry
        if (attempt < maxAttempts) {
          const delay = config.quality.retry.backoffMultiplier ** (attempt - 1) * 1000;
          console.log(`[DigestEngine] Validation failed, retrying in ${delay}ms...`);
          console.log(`[DigestEngine] Score: ${validationReport.score}, Critical issues: ${validationReport.criticalIssues.length}`);
          validationReport.criticalIssues.forEach((issue, i) => {
            console.log(`[DigestEngine] Critical issue ${i + 1}: ${issue.type} - ${issue.message}`);
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        console.error(`[DigestEngine] Generation attempt ${attempt} failed`, error);
        
        if (attempt >= maxAttempts) {
          throw error;
        }
        
        // Retry with backoff
        const delay = config.quality.retry.backoffMultiplier ** (attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // All attempts failed - save error digest for debugging
    console.error(`[DigestEngine] All ${maxAttempts} attempts failed for ${dateCode}, saving error record`);
    console.error(`[DigestEngine] Total papers: ${papers.length}`);
    
    try {
      // Get the last validation report details
      const lastValidation = await this.validator.validate(
        await this.generator.generate(papers, dateCode, config),
        papers,
        config
      );
      
      const errorDetails = {
        error: `Failed after ${maxAttempts} attempts`,
        score: lastValidation.score,
        criticalIssues: lastValidation.criticalIssues,
        warnings: lastValidation.warnings,
        details: lastValidation.details
      };
      
      await prisma.dailyDigestLog.upsert({
        where: { dateCode },
        create: {
          dateCode,
          title: `Failed to generate digest for ${dateCode}`,
          subtitle: 'Generation failed after all retry attempts',
          content: `Failed to generate digest after ${maxAttempts} attempts.\n\nScore: ${lastValidation.score}\nCritical Issues: ${lastValidation.criticalIssues.length}\n\nDetails:\n${JSON.stringify(errorDetails, null, 2)}`,
          type: 'DailyDigest',
          actualCount: papers.length,
          totalCount: papers.length,
          status: 'error',
          qualityScore: lastValidation.score,
          validationIssues: JSON.stringify(errorDetails),
        },
        update: {
          status: 'error',
          updatedAt: new Date()
        }
      });
    } catch (saveError) {
      console.error(`[DigestEngine] Failed to save error digest`, saveError);
    }
    
    return {
      success: false,
      retries: maxAttempts,
      error: new DigestGenerationError(`Failed to generate digest after ${maxAttempts} attempts`)
    };
  }
  
  /**
   * Save generated digest to database with transaction safety
   */
  private async saveDigest(
    dateCode: string, 
    generated: GeneratedContent, 
    validationReport: ValidationReport | null,
    papers: Paper[]
  ): Promise<DailyDigestLog> {
    // Calculate actual count (excluding deleted)
    const actualCount = papers.length;
    
    // Use transaction for atomic operations
    const digest = await prisma.$transaction(async (tx) => {
      // Create or update digest
      const result = await tx.dailyDigestLog.upsert({
        where: { dateCode },
        create: {
          dateCode,
          title: generated.title,
          subtitle: generated.subtitle,
          content: generated.content,
          type: 'DailyDigest',
          actualCount,
          totalCount: actualCount,
          status: 'published',
          qualityScore: validationReport?.score ?? null,
          validationIssues: validationReport ? JSON.stringify(validationReport.details) : null,
          papers: {
            connect: papers.map(p => ({ id: p.id }))
          }
        },
        update: {
          title: generated.title,
          subtitle: generated.subtitle,
          content: generated.content,
          actualCount,
          totalCount: actualCount,
          status: 'published',
          qualityScore: validationReport?.score ?? null,
          validationIssues: validationReport ? JSON.stringify(validationReport.details) : null,
          papers: {
            set: [], // Clear existing
            connect: papers.map(p => ({ id: p.id }))
          },
          updatedAt: new Date()
        },
        include: {
          papers: true
        }
      });
      
      return result;
    });
    
    return this.mapPrismaDigestToType(digest);
  }
  
  /**
   * Regenerate a digest (admin operation)
   */
  async regenerateDigest(dateCode: string): Promise<DigestResult> {
    // Delete existing digest if any
    await prisma.dailyDigestLog.deleteMany({
      where: { dateCode }
    });
    
    // Trigger new generation
    return this.triggerDailyDigestUpdate(new Date(dateCode));
  }
  
  /**
   * Get or create a digest
   */
  async getOrCreateDigest(dateCode: string): Promise<DailyDigestLog> {
    // Try to get existing
    const existing = await prisma.dailyDigestLog.findUnique({
      where: { dateCode },
      include: { papers: true }
    });
    
    if (existing) {
      return this.mapPrismaDigestToType(existing);
    }
    
    // Generate new digest
    const result = await this.triggerDailyDigestUpdate(new Date(dateCode));
    
    if (!result.success || !result.digest) {
      throw new DigestGenerationError(`Failed to generate digest for ${dateCode}`);
    }
    
    return result.digest;
  }
  
  /**
    * Cleanup deleted papers from digests
    */
  async cleanupDeletedPapers(paperId: string): Promise<void> {
    await this.cascadeHandler.handleDeletion(paperId);
  }
  
  /**
   * Map Prisma digest result to typed DailyDigestLog
   */
  private mapPrismaDigestToType(prismaDigest: Record<string, unknown>): DailyDigestLog {
    return {
      id: prismaDigest.id as string,
      dateCode: prismaDigest.dateCode as string,
      title: prismaDigest.title as string,
      subtitle: prismaDigest.subtitle as string | null,
      content: prismaDigest.content as string,
      type: prismaDigest.type as string,
      actualCount: prismaDigest.actualCount as number,
      totalCount: prismaDigest.totalCount as number,
      status: prismaDigest.status as 'draft' | 'published' | 'archived' | 'error',
      qualityScore: prismaDigest.qualityScore as number | null,
      validationIssues: prismaDigest.validationIssues as string | null,
      createdAt: prismaDigest.createdAt as Date,
      updatedAt: prismaDigest.updatedAt as Date,
      papers: this.mapPrismaPapersToType((prismaDigest.papers || []) as Record<string, unknown>[])
    };
  }

  /**
   * Map Prisma paper results to typed Paper array
   */
  private mapPrismaPapersToType(prismaPapers: Record<string, unknown>[]): Paper[] {
    return prismaPapers.map(p => ({
      id: p.id as string,
      title: p.title as string,
      abstract: p.abstract as string | null,
      url: p.url as string,
      source: p.source as string,
      sourceType: p.sourceType as string | null,
      publicationDate: p.publicationDate as Date,
      collectedAt: p.collectedAt as Date,
      aiSummary: p.aiSummary as string | null,
      relevanceScore: p.relevanceScore as number | null,
      technicalScore: p.technicalScore as number | null,
      businessScore: p.businessScore as number | null,
      timelinessScore: p.timelinessScore as number | null,
      practicalityScore: p.practicalityScore as number | null,
      assessmentReason: p.assessmentReason as string | null,
      technicalBonusApplied: p.technicalBonusApplied as boolean,
      deletedAt: p.deletedAt as Date | null,
      tags: (p.tags || []) as PaperTag[],
      dailyDigests: []
    }));
  }
}

// Export singleton instance
export const digestEngine = new DigestEngineImpl();
