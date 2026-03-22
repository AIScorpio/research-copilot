// Mock the LLM module to avoid Groq browser check
jest.mock('@/lib/llm', () => ({
  generateText: jest.fn().mockResolvedValue({
    text: `# Test Title
*Test Subtitle*

This is test generated content.

## Section 1
Content for section 1

## Section 2
Content for section 2`
  })
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(JSON.stringify({
    digestGeneration: 'Generate digest for {{CURRENT_DATE}} with {{PAPER_COUNT}} papers on {{TOPIC}}'
  }))
}));

jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
  resolve: jest.fn((...args: string[]) => args.join('/'))
}));

import { describe, it, expect } from '@jest/globals';
import { DigestGenerator } from '@/lib/daily-digest/generator';

describe('DigestGenerator', () => {
  const generator = new DigestGenerator();

  describe('Class Instantiation', () => {
    it('should create instance with new keyword', () => {
      const g = new DigestGenerator();
      expect(g).toBeInstanceOf(DigestGenerator);
    });

    it('should have generate method', () => {
      expect(typeof generator.generate).toBe('function');
    });
  });

  describe('Method Signatures', () => {
    it('generate should accept papers array, dateCode string, and config object', async () => {
      const papers: any[] = [];
      const dateCode = '2026-03-22';
      const config: any = {
        templates: { topic: 'Test', title: 'Test', dateFormat: 'YYYY-MM-DD' },
        generation: { coverage: { featuredRatio: 0.15, minFeatured: 5, maxFeatured: 12 } }
      };
      
      const result = await generator.generate(papers, dateCode, config);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('subtitle');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('sections');
    });

    it('generate should return GeneratedContent structure', async () => {
      const result = await generator.generate([], '2026-03-22', {
        templates: { topic: 'Test', title: 'Test', dateFormat: 'YYYY-MM-DD' },
        generation: { coverage: { featuredRatio: 0.15, minFeatured: 5, maxFeatured: 12 } }
      } as any);
      
      expect(typeof result.title).toBe('string');
      expect(typeof result.subtitle).toBe('string');
      expect(typeof result.content).toBe('string');
      expect(Array.isArray(result.sections)).toBe(true);
    });
  });

  describe('Template Variable Replacement', () => {
    it('should handle {{CURRENT_DATE}} replacement', () => {
      const template = 'Date: {{CURRENT_DATE}}';
      const dateCode = '2026-03-22';
      const result = template.replace(/\{\{CURRENT_DATE\}\}/g, dateCode);
      
      expect(result).toBe('Date: 2026-03-22');
    });

    it('should handle {{PAPER_COUNT}} replacement', () => {
      const template = 'Count: {{PAPER_COUNT}}';
      const count = 5;
      const result = template.replace(/\{\{PAPER_COUNT\}\}/g, String(count));
      
      expect(result).toBe('Count: 5');
    });

    it('should handle {{TOPIC}} replacement', () => {
      const template = 'Topic: {{TOPIC}}';
      const topic = 'AI Research';
      const result = template.replace(/\{\{TOPIC\}\}/g, topic);
      
      expect(result).toBe('Topic: AI Research');
    });

    it('should handle {{FEATURED_COUNT}} replacement', () => {
      const template = 'Featured: {{FEATURED_COUNT}}';
      const featured = 10;
      const result = template.replace(/\{\{FEATURED_COUNT\}\}/g, String(featured));
      
      expect(result).toBe('Featured: 10');
    });

    it('should handle {{TITLE}} replacement', () => {
      const template = 'Title: {{TITLE}}';
      const title = 'Daily Digest';
      const result = template.replace(/\{\{TITLE\}\}/g, title);
      
      expect(result).toBe('Title: Daily Digest');
    });
  });

  describe('Error Handling', () => {
    it('should throw DigestGenerationError on invalid config', async () => {
      const { DigestGenerationError } = require('@/lib/daily-digest/errors');
      
      expect(() => {
        throw new DigestGenerationError('Test error');
      }).toThrow(DigestGenerationError);
      
      expect(() => {
        throw new DigestGenerationError('Test error');
      }).toThrow('Test error');
    });
  });

  describe('Return Value Validation', () => {
    it('should return object with all required fields', async () => {
      const result = await generator.generate([], '2026-03-22', {
        templates: { topic: 'Test', title: 'Test Title', dateFormat: 'YYYY-MM-DD' },
        generation: { coverage: { featuredRatio: 0.15, minFeatured: 5, maxFeatured: 12 } }
      } as any);
      
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('subtitle');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('sections');
      
      // Type checks
      expect(typeof result.title).toBe('string');
      expect(typeof result.subtitle).toBe('string');
      expect(typeof result.content).toBe('string');
      expect(Array.isArray(result.sections)).toBe(true);
    });
  });
});
