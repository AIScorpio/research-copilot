import { describe, it, expect } from '@jest/globals';
import { schemas } from '@/lib/validation/schemas';

describe('Validation Schemas', () => {
  describe('Auth Schemas', () => {
    it('should validate valid registration data', () => {
      const result = schemas.auth.register.safeParse({
        email: 'test@example.com',
        password: 'securePassword123'
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = schemas.auth.register.safeParse({
        email: 'invalid-email',
        password: 'securePassword123'
      });
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = schemas.auth.register.safeParse({
        email: 'test@example.com',
        password: 'short'
      });
      expect(result.success).toBe(false);
    });

    it('should validate valid login data', () => {
      const result = schemas.auth.login.safeParse({
        email: 'test@example.com',
        password: 'anyPassword'
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Papers Schemas', () => {
    it('should validate valid query params', () => {
      const result = schemas.papers.query.safeParse({
        search: 'AI',
        sector: 'Banking',
        topic: 'Machine Learning',
        page: 1,
        pageSize: 50
      });
      expect(result.success).toBe(true);
    });

    it('should coerce string to number for pagination', () => {
      const result = schemas.papers.query.safeParse({
        page: '1',
        pageSize: '50'
      });
      expect(result.success).toBe(true);
      expect(result.data?.page).toBe(1);
      expect(result.data?.pageSize).toBe(50);
    });

    it('should reject invalid page number', () => {
      const result = schemas.papers.query.safeParse({
        page: 0
      });
      expect(result.success).toBe(false);
    });

    it('should reject page size over 100', () => {
      const result = schemas.papers.query.safeParse({
        pageSize: 150
      });
      expect(result.success).toBe(false);
    });

    it('should validate UUID format', () => {
      const result = schemas.papers.id.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000'
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = schemas.papers.id.safeParse({
        id: 'not-a-uuid'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Alerts Schemas', () => {
    it('should validate valid query params with z.coerce', () => {
      const result = schemas.alerts.query.safeParse({
        status: 'new',
        priority: 'HIGH',
        limit: '50',
        offset: '0'
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(50);
      expect(result.data?.offset).toBe(0);
    });

    it('should validate valid update data', () => {
      const result = schemas.alerts.update.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'read',
        priority: 'MEDIUM'
      });
      expect(result.success).toBe(true);
    });

    it('should validate valid create data', () => {
      const result = schemas.alerts.create.safeParse({
        sourceId: 'source-123',
        sourceName: 'Test Source',
        title: 'Test Alert',
        content: 'Test content',
        url: 'https://example.com/test',
        keywords: ['test', 'alert'],
        relevance: 85,
        priority: 'HIGH'
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid relevance score', () => {
      const result = schemas.alerts.create.safeParse({
        sourceId: 'source-123',
        sourceName: 'Test Source',
        title: 'Test Alert',
        content: 'Test content',
        url: 'https://example.com/test',
        keywords: ['test'],
        relevance: 150,
        priority: 'HIGH'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Sources Schemas', () => {
    it('should validate valid source creation', () => {
      const result = schemas.sources.create.safeParse({
        name: 'Test Source',
        url: 'https://example.com'
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const result = schemas.sources.create.safeParse({
        name: 'Test Source',
        url: 'not-a-url'
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = schemas.sources.create.safeParse({
        name: '',
        url: 'https://example.com'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Export Schemas', () => {
    it('should validate valid digest config', () => {
      const result = schemas.export.digest.safeParse({
        frequency: 'weekly',
        recipientEmail: 'test@example.com',
        includePowerPoint: true,
        includeSocialPosts: false,
        maxPapers: 20,
        days: 7
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = schemas.export.digest.safeParse({
        frequency: 'daily',
        recipientEmail: 'invalid-email'
      });
      expect(result.success).toBe(false);
    });

    it('should validate social media config', () => {
      const result = schemas.export.socialMedia.safeParse({
        paperIds: ['550e8400-e29b-41d4-a716-446655440000'],
        platform: 'LinkedIn',
        count: 5
      });
      expect(result.success).toBe(true);
    });

    it('should validate PowerPoint config', () => {
      const result = schemas.export.powerPoint.safeParse({
        days: 30,
        limit: 10,
        includeAbstract: true,
        includeSummary: false,
        includeTags: true
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Chat Schema', () => {
    it('should validate valid chat messages', () => {
      const result = schemas.chat.safeParse({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ]
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid role', () => {
      const result = schemas.chat.safeParse({
        messages: [
          { role: 'invalid', content: 'Hello' }
        ]
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty message content', () => {
      const result = schemas.chat.safeParse({
        messages: [
          { role: 'user', content: '' }
        ]
      });
      expect(result.success).toBe(false);
    });

    it('should reject too many messages', () => {
      const result = schemas.chat.safeParse({
        messages: Array(51).fill({ role: 'user' as const, content: 'test' })
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Trends Schemas', () => {
    it('should validate valid trends query', () => {
      const result = schemas.trends.query.safeParse({
        period: 'week',
        limit: 50,
        direction: 'up'
      });
      expect(result.success).toBe(true);
    });

    it('should validate trending request', () => {
      const result = schemas.trends.trending.safeParse({
        period: 'month',
        limit: 10
      });
      expect(result.success).toBe(true);
    });
  });
});
