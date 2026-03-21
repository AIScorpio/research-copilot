import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { DigestCascadeHandler } from '@/lib/daily-digest/cascade-handler';
import { prisma } from '@/lib/db';

describe('DigestCascadeHandler', () => {
  let handler: DigestCascadeHandler;

  beforeEach(() => {
    // Mock Prisma methods using spyOn
    jest.spyOn(prisma.dailyDigestLog, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.dailyDigestLog, 'update').mockResolvedValue({} as any);
    jest.spyOn(prisma.paper, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma, '$transaction').mockImplementation((callback: any) => callback({
      dailyDigestLog: {
        update: jest.fn().mockResolvedValue({})
      }
    }));
    
    handler = new DigestCascadeHandler();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Class Instantiation', () => {
    it('should create instance with new keyword', () => {
      const h = new DigestCascadeHandler();
      expect(h).toBeInstanceOf(DigestCascadeHandler);
    });

    it('should have all required methods', () => {
      expect(typeof handler.initialize).toBe('function');
      expect(typeof handler.handleDeletion).toBe('function');
      expect(typeof handler.handleBatchDeletion).toBe('function');
    });
  });

  describe('Method Signatures', () => {
    it('initialize should return Promise', async () => {
      const result = handler.initialize();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.not.toThrow();
    });

    it('handleDeletion should accept string paperId', async () => {
      const paperId = 'test-paper-id';
      await expect(handler.handleDeletion(paperId)).resolves.not.toThrow();
    });

    it('handleBatchDeletion should accept string array', async () => {
      const paperIds = ['paper-1', 'paper-2', 'paper-3'];
      const result = await handler.handleBatchDeletion(paperIds);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('failed');
      expect(Array.isArray(result.successful)).toBe(true);
      expect(Array.isArray(result.failed)).toBe(true);
    });
  });

  describe('Return Types', () => {
    it('handleBatchDeletion should return BatchResult', async () => {
      const result = await handler.handleBatchDeletion(['id1', 'id2']);
      
      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('failed');
      expect(Array.isArray(result.successful)).toBe(true);
      expect(Array.isArray(result.failed)).toBe(true);
    });

    it('successful array should contain processed paperIds', async () => {
      const paperIds = ['id1'];
      const result = await handler.handleBatchDeletion(paperIds);
      
      // Should process all papers (may succeed or fail, but should track)
      expect(result.successful.length + result.failed.length).toBe(paperIds.length);
    });

    it('failed array should contain error details', async () => {
      const result = await handler.handleBatchDeletion(['id1']);
      
      // Check structure of failed items if any
      if (result.failed.length > 0) {
        const failedItem = result.failed[0];
        expect(failedItem).toHaveProperty('paperId');
        expect(failedItem).toHaveProperty('error');
        expect(typeof failedItem.paperId).toBe('string');
        expect(typeof failedItem.error).toBe('string');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle empty paperId gracefully', async () => {
      await expect(handler.handleDeletion('')).resolves.not.toThrow();
    });

    it('should handle empty batch gracefully', async () => {
      const result = await handler.handleBatchDeletion([]);
      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle non-existent paperId gracefully', async () => {
      const paperId = 'non-existent-id';
      await expect(handler.handleDeletion(paperId)).resolves.not.toThrow();
    });

    it('should continue processing on individual failures', async () => {
      const paperIds = ['id1', 'id2', 'id3'];
      const result = await handler.handleBatchDeletion(paperIds);
      
      // Should process all papers regardless of individual outcomes
      const totalProcessed = result.successful.length + result.failed.length;
      expect(totalProcessed).toBe(paperIds.length);
    });
  });

  describe('Singleton Export', () => {
    it('should export singleton cascadeHandler instance', () => {
      const { cascadeHandler } = require('@/lib/daily-digest/cascade-handler');
      expect(cascadeHandler).toBeDefined();
      expect(cascadeHandler).toBeInstanceOf(DigestCascadeHandler);
    });

    it('singleton should be same instance on multiple imports', () => {
      const module1 = require('@/lib/daily-digest/cascade-handler');
      const module2 = require('@/lib/daily-digest/cascade-handler');
      
      expect(module1.cascadeHandler).toBe(module2.cascadeHandler);
    });
  });
});
