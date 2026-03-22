import { describe, it, expect } from '@jest/globals';
import { DigestValidator } from '@/lib/daily-digest/validator';

describe('DigestValidator', () => {
  const validator = new DigestValidator();

  describe('Class Instantiation', () => {
    it('should create instance with new keyword', () => {
      const v = new DigestValidator();
      expect(v).toBeInstanceOf(DigestValidator);
    });

    it('should have validate method', () => {
      expect(typeof validator.validate).toBe('function');
    });
  });

  describe('Method Signatures', () => {
    it('validate should accept content, papers array, and config', async () => {
      const today = new Date().toISOString().split('T')[0];
      const content: any = {
        title: 'Test',
        subtitle: 'Subtitle',
        content: `Content with date: ${today}`,
        sections: [],
        dateCode: today
      };
      const papers: any[] = [];
      const config: any = {
        quality: {
          validationEnabled: true,
          targetScore: 10,
          minAcceptableScore: 9,
          validators: {
            dateAccuracy: { enabled: true, weight: 0.30 },
            citationExistence: { enabled: true, weight: 0.25 },
            coverage: { enabled: true, minPercent: 50, weight: 0.20 },
            statisticsAccuracy: { enabled: true, weight: 0.15 },
            formatConsistency: { enabled: true, weight: 0.10 }
          }
        }
      };
      
      const result = await validator.validate(content, papers, config);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('criticalIssues');
      expect(result).toHaveProperty('warnings');
    });

    it('validate should return ValidationReport structure', async () => {
      const today = new Date().toISOString().split('T')[0];
      const result = await validator.validate(
        { title: 'Test', subtitle: '', content: `Test content for ${today}`, sections: [], dateCode: today },
        [],
        {
          quality: {
            validationEnabled: true,
            targetScore: 10,
            minAcceptableScore: 9,
            validators: {
              dateAccuracy: { enabled: true, weight: 0.30 },
              citationExistence: { enabled: true, weight: 0.25 },
              coverage: { enabled: true, minPercent: 50, weight: 0.20 },
              statisticsAccuracy: { enabled: true, weight: 0.15 },
              formatConsistency: { enabled: true, weight: 0.10 }
            }
          }
        } as any
      );
      
      expect(typeof result.passed).toBe('boolean');
      expect(typeof result.score).toBe('number');
      expect(Array.isArray(result.details)).toBe(true);
      expect(Array.isArray(result.criticalIssues)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('Return Value Validation', () => {
    it('should return score between 0 and 10', async () => {
      const today = new Date().toISOString().split('T')[0];
      const result = await validator.validate(
        { title: 'Test', subtitle: '', content: `Test content for ${today}`, sections: [], dateCode: today },
        [],
        {
          quality: {
            validationEnabled: true,
            targetScore: 10,
            minAcceptableScore: 9,
            validators: {
              dateAccuracy: { enabled: true, weight: 0.30 },
              citationExistence: { enabled: true, weight: 0.25 },
              coverage: { enabled: true, minPercent: 50, weight: 0.20 },
              statisticsAccuracy: { enabled: true, weight: 0.15 },
              formatConsistency: { enabled: true, weight: 0.10 }
            }
          }
        } as any
      );
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(10);
    });

    it('should return boolean passed flag', async () => {
      const today = new Date().toISOString().split('T')[0];
      const result = await validator.validate(
        { title: 'Test', subtitle: '', content: `Test content for ${today}`, sections: [], dateCode: today },
        [],
        {
          quality: {
            validationEnabled: true,
            targetScore: 10,
            minAcceptableScore: 9,
            validators: {
              dateAccuracy: { enabled: true, weight: 0.30 },
              citationExistence: { enabled: true, weight: 0.25 },
              coverage: { enabled: true, minPercent: 50, weight: 0.20 },
              statisticsAccuracy: { enabled: true, weight: 0.15 },
              formatConsistency: { enabled: true, weight: 0.10 }
            }
          }
        } as any
      );
      
      expect(typeof result.passed).toBe('boolean');
    });

    it('should return arrays for details, criticalIssues, warnings', async () => {
      const today = new Date().toISOString().split('T')[0];
      const result = await validator.validate(
        { title: 'Test', subtitle: '', content: `Test content for ${today}`, sections: [], dateCode: today },
        [],
        {
          quality: {
            validationEnabled: true,
            targetScore: 10,
            minAcceptableScore: 9,
            validators: {
              dateAccuracy: { enabled: true, weight: 0.30 },
              citationExistence: { enabled: true, weight: 0.25 },
              coverage: { enabled: true, minPercent: 50, weight: 0.20 },
              statisticsAccuracy: { enabled: true, weight: 0.15 },
              formatConsistency: { enabled: true, weight: 0.10 }
            }
          }
        } as any
      );
      
      expect(Array.isArray(result.details)).toBe(true);
      expect(Array.isArray(result.criticalIssues)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('Config Handling', () => {
    it('should handle validationEnabled flag', async () => {
      const today = new Date().toISOString().split('T')[0];
      const config: any = {
        quality: {
          validationEnabled: false,
          targetScore: 10,
          minAcceptableScore: 9,
          validators: {
            dateAccuracy: { enabled: true, weight: 0.30 },
            citationExistence: { enabled: true, weight: 0.25 },
            coverage: { enabled: true, minPercent: 50, weight: 0.20 },
            statisticsAccuracy: { enabled: true, weight: 0.15 },
              formatConsistency: { enabled: true, weight: 0.10 }
          }
        }
      };
      
      const result = await validator.validate(
        { title: 'Test', subtitle: '', content: `Test content for ${today}`, sections: [], dateCode: today },
        [],
        config
      );
      
      expect(result).toBeDefined();
    });
  });
});
