import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { DigestEngineImpl } from '@/lib/daily-digest/engine';
import type { DailyDigestEngine } from '@/lib/daily-digest/engine';
import { prisma } from '@/lib/db';

describe('DigestEngineImpl', () => {
  let engine: DailyDigestEngine;

  beforeEach(() => {
    // Mock all Prisma methods using spyOn
    jest.spyOn(prisma.dailyDigestLog, 'findUnique').mockResolvedValue(null);
    jest.spyOn(prisma.dailyDigestLog, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.dailyDigestLog, 'upsert').mockResolvedValue({
      id: 'test-id',
      dateCode: '2026-03-22',
      title: 'Test Digest',
      subtitle: null,
      content: 'Test content',
      type: 'DailyDigest',
      actualCount: 0,
      totalCount: 0,
      status: 'published',
      qualityScore: 9.5,
      validationIssues: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      papers: []
    } as any);
    jest.spyOn(prisma.dailyDigestLog, 'deleteMany').mockResolvedValue({ count: 0 });
    jest.spyOn(prisma.dailyDigestLog, 'delete').mockResolvedValue({} as any);
    jest.spyOn(prisma.dailyDigestLog, 'update').mockResolvedValue({});
    jest.spyOn(prisma.paper, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.paper, 'count').mockResolvedValue(0);
    jest.spyOn(prisma, '$transaction').mockImplementation((callback: any) => callback({
      dailyDigestLog: {
        upsert: jest.fn().mockResolvedValue({
          id: 'test-id',
          dateCode: '2026-03-22',
          title: 'Test Digest',
          content: 'Test content',
          status: 'published',
          papers: []
        })
      }
    }));
    jest.spyOn(prisma.digestGenerationLock, 'findUnique').mockResolvedValue(null);
    jest.spyOn(prisma.digestGenerationLock, 'create').mockResolvedValue({});
    jest.spyOn(prisma.digestGenerationLock, 'update').mockResolvedValue({});
    jest.spyOn(prisma.digestGenerationLock, 'delete').mockResolvedValue({});
    
    engine = new DigestEngineImpl();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Engine Interface Contract', () => {
    it('should implement DailyDigestEngine interface with all 4 required methods', () => {
      expect(typeof engine.triggerDailyDigestUpdate).toBe('function');
      expect(typeof engine.regenerateDigest).toBe('function');
      expect(typeof engine.getOrCreateDigest).toBe('function');
      expect(typeof engine.cleanupDeletedPapers).toBe('function');
    });

    it('should return Promise from all async methods', () => {
      const date = new Date('2026-03-22');
      
      expect(engine.triggerDailyDigestUpdate(date)).toBeInstanceOf(Promise);
      expect(engine.regenerateDigest('2026-03-22')).toBeInstanceOf(Promise);
      expect(engine.getOrCreateDigest('2026-03-22')).toBeInstanceOf(Promise);
      expect(engine.cleanupDeletedPapers('test-id')).toBeInstanceOf(Promise);
    });
  });

  describe('Method Signatures', () => {
    it('triggerDailyDigestUpdate should accept optional Date parameter', async () => {
      // Should work with date
      const result1 = await engine.triggerDailyDigestUpdate(new Date('2026-03-22'));
      expect(result1).toHaveProperty('success');
      
      // Should work without date (uses current date)
      const result2 = await engine.triggerDailyDigestUpdate();
      expect(result2).toHaveProperty('success');
    });

    it('regenerateDigest should accept string dateCode', async () => {
      // Mock to return an existing digest so regenerateDigest returns it
      prisma.dailyDigestLog.findUnique.mockResolvedValue({
        id: 'test-id',
        dateCode: '2026-03-22',
        title: 'Test Digest',
        subtitle: null,
        content: 'Test content',
        type: 'DailyDigest',
        actualCount: 0,
        totalCount: 0,
        status: 'published',
        qualityScore: 9.5,
        validationIssues: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        papers: []
      });
      
      const result = await engine.regenerateDigest('2026-03-22');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('digest');
    });

    it('getOrCreateDigest should accept string dateCode and return DailyDigestLog', async () => {
      // Mock to return an existing digest
      (prisma.dailyDigestLog.findUnique as jest.Mock).mockResolvedValue({
        id: 'test-id',
        dateCode: '2026-03-22',
        title: 'Test Digest',
        subtitle: null,
        content: 'Test content',
        type: 'DailyDigest',
        actualCount: 0,
        totalCount: 0,
        status: 'published',
        qualityScore: 9.5,
        validationIssues: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        papers: []
      });
      
      const digest = await engine.getOrCreateDigest('2026-03-22');
      expect(digest).toBeDefined();
      expect(digest).toHaveProperty('dateCode');
      expect(digest).toHaveProperty('title');
      expect(digest).toHaveProperty('content');
    });

    it('cleanupDeletedPapers should accept string paperId', async () => {
      // Mock the cascade handler to avoid singleton issues
      const mockCascadeHandler = {
        handleDeletion: jest.fn().mockResolvedValue(undefined)
      };
      (engine as any).cascadeHandler = mockCascadeHandler;
      
      // Should not throw
      await expect(engine.cleanupDeletedPapers('test-paper-id')).resolves.not.toThrow();
      expect(mockCascadeHandler.handleDeletion).toHaveBeenCalledWith('test-paper-id');
    });
  });

  describe('Return Types', () => {
    it('triggerDailyDigestUpdate should return DigestResult with correct structure', async () => {
      // Mock to return an existing digest
      (prisma.dailyDigestLog.findUnique as jest.Mock).mockResolvedValue({
        id: 'test-id',
        dateCode: '2026-03-22',
        title: 'Test Digest',
        subtitle: null,
        content: 'Test content',
        type: 'DailyDigest',
        actualCount: 0,
        totalCount: 0,
        status: 'published',
        qualityScore: 9.5,
        validationIssues: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        papers: []
      });
      
      const result = await engine.triggerDailyDigestUpdate(new Date('2026-03-22'));
      
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        expect(result).toHaveProperty('digest');
        expect(result).toHaveProperty('retries');
        expect(typeof result.retries).toBe('number');
      }
    });

    it('regenerateDigest should return DigestResult', async () => {
      const result = await engine.regenerateDigest('2026-03-22');
      
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid date gracefully', async () => {
      // Invalid dates throw RangeError when toISOString is called
      // This tests that the error propagates correctly
      const invalidDate = new Date('invalid');
      await expect(engine.triggerDailyDigestUpdate(invalidDate)).rejects.toThrow(RangeError);
    });

    it('should handle empty dateCode gracefully', async () => {
      // Empty string creates invalid date which throws RangeError
      await expect(engine.regenerateDigest('')).rejects.toThrow(RangeError);
    });
  });

  describe('Singleton Export', () => {
    it('should export singleton digestEngine instance', () => {
      const { digestEngine } = require('@/lib/daily-digest/engine');
      expect(digestEngine).toBeDefined();
      expect(digestEngine).toBeInstanceOf(DigestEngineImpl);
    });

    it('singleton should be same instance on multiple imports', () => {
      const module1 = require('@/lib/daily-digest/engine');
      const module2 = require('@/lib/daily-digest/engine');
      
      expect(module1.digestEngine).toBe(module2.digestEngine);
    });
  });
});
