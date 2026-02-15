import {
  generatePoCRecommendations,
  savePoCRecommendation,
  getRecentPoCRecommendations,
  ReadinessLevel
} from '@/lib/recommendations';

describe('PoC Recommendations', () => {
  describe('generatePoCRecommendations', () => {
    it('should return array of recommendations', async () => {
      const recommendations = await generatePoCRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const recommendations = await generatePoCRecommendations(5);
      expect(recommendations.length).toBeLessThanOrEqual(5);
    });

    it('should default to 10 recommendations', async () => {
      const recommendations = await generatePoCRecommendations();
      expect(recommendations.length).toBeLessThanOrEqual(10);
    });

    it('should accept high limit values', async () => {
      const recommendations = await generatePoCRecommendations(50);
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('recommendation structure', () => {
    it('should have correct recommendation fields', async () => {
      const recommendations = await generatePoCRecommendations(5);
      if (recommendations.length > 0) {
        const rec = recommendations[0];
        expect(rec).toHaveProperty('id');
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('description');
        expect(rec).toHaveProperty('technology');
        expect(rec).toHaveProperty('riskDomain');
        expect(rec).toHaveProperty('estimatedEffort');
        expect(rec).toHaveProperty('businessValue');
        expect(rec).toHaveProperty('relatedPapers');
        expect(rec).toHaveProperty('confidence');
        expect(rec).toHaveProperty('createdAt');
      }
    });

    it('should have valid confidence scores', async () => {
      const recommendations = await generatePoCRecommendations(10);
      recommendations.forEach(rec => {
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should have valid effort levels', async () => {
      const recommendations = await generatePoCRecommendations(10);
      recommendations.forEach(rec => {
        expect(['Low', 'Medium', 'High']).toContain(rec.estimatedEffort);
      });
    });

    it('should have valid business value levels', async () => {
      const recommendations = await generatePoCRecommendations(10);
      recommendations.forEach(rec => {
        expect(['Low', 'Medium', 'High']).toContain(rec.businessValue);
      });
    });

    it('should have valid related papers array', async () => {
      const recommendations = await generatePoCRecommendations(10);
      recommendations.forEach(rec => {
        expect(Array.isArray(rec.relatedPapers)).toBe(true);
      });
    });
  });

  describe('savePoCRecommendation', () => {
    it('should handle saving recommendation', async () => {
      const mockRecommendation = {
        id: 'test-id',
        title: 'Test Recommendation',
        domain: 'Credit Risk',
        description: 'Test Description',
        technology: 'AI',
        riskDomain: 'Credit Risk',
        readiness: ReadinessLevel.EMERGING,
        readinessScore: 30,
        estimatedEffort: 'Low' as const,
        businessValue: 'High' as const,
        bankingTags: ['tag1', 'tag2'],
        bankingUseCases: ['usecase1'],
        relatedPapers: [],
        confidence: 0.8,
        createdAt: new Date()
      };

      await expect(savePoCRecommendation(mockRecommendation)).resolves.not.toThrow();
    });
  });

  describe('getRecentPoCRecommendations', () => {
    it('should return array', async () => {
      const recommendations = await getRecentPoCRecommendations(30);
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });
});
