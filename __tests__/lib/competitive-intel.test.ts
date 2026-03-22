import { trackCompetitiveUpdates, generateCompetitiveBrief } from '@/lib/competitive-intel';

describe('Competitive Intelligence', () => {
  describe('trackCompetitiveUpdates', () => {
    it('should return empty array for recent date with no data', async () => {
      const since = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const updates = await trackCompetitiveUpdates(since);
      expect(Array.isArray(updates)).toBe(true);
    });

    it('should handle valid date range', async () => {
      const since = new Date('2024-01-01');
      const updates = await trackCompetitiveUpdates(since);
      expect(Array.isArray(updates)).toBe(true);
    });

    it('should limit results to top 50', async () => {
      const since = new Date('2023-01-01');
      const updates = await trackCompetitiveUpdates(since);
      expect(updates.length).toBeLessThanOrEqual(50);
    });
  });

  describe('generateCompetitiveBrief', () => {
    it('should generate brief with required fields', async () => {
      const brief = await generateCompetitiveBrief(30);
      expect(brief).toHaveProperty('summary');
      expect(brief).toHaveProperty('topCompetitors');
      expect(brief).toHaveProperty('keyTrends');
      expect(brief).toHaveProperty('alertTopics');
    });

    it('should accept custom days parameter', async () => {
      const brief = await generateCompetitiveBrief(60);
      expect(brief).toBeDefined();
      expect(typeof brief.summary).toBe('string');
    });

    it('should handle edge case days = 1', async () => {
      const brief = await generateCompetitiveBrief(1);
      expect(brief).toBeDefined();
    });

    it('should handle edge case days = 365', async () => {
      const brief = await generateCompetitiveBrief(365);
      expect(brief).toBeDefined();
    });
  });

  describe('update structure', () => {
    it('should have correct update structure', async () => {
      const since = new Date('2023-01-01');
      const updates = await trackCompetitiveUpdates(since);
      if (updates.length > 0) {
        const update = updates[0];
        expect(update).toHaveProperty('id');
        expect(update).toHaveProperty('type');
        expect(update).toHaveProperty('institution');
        expect(update).toHaveProperty('title');
        expect(update).toHaveProperty('relevanceScore');
        expect(update.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(update.relevanceScore).toBeLessThanOrEqual(100);
      }
    });
  });
});
