import { emailService } from '@/lib/email-service';

describe('Email Service', () => {
  const mockPapers = [
    {
      title: 'AI in Banking',
      abstract: 'This paper discusses AI applications in banking.',
      url: 'https://example.com/paper1',
      source: 'ArXiv',
      publicationDate: new Date('2024-01-01'),
      tags: [{ tag: { name: 'AI', category: 'ai-technology' } }]
    },
    {
      title: 'Fraud Detection',
      abstract: 'Using ML for fraud detection.',
      url: 'https://example.com/paper2',
      source: 'IEEE',
      publicationDate: new Date('2024-01-15'),
      tags: [{ tag: { name: 'Fraud Detection', category: 'business-area' } }]
    }
  ];

  describe('EmailService instantiation', () => {
    it('should create email service instance', () => {
      expect(emailService).toBeDefined();
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const result = await emailService.sendEmail(
        'test@example.com',
        'Test Subject',
        '<p>Test HTML</p>'
      );

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });

    it('should return messageId on success', async () => {
      const result = await emailService.sendEmail(
        'test@example.com',
        'Test Subject',
        '<p>Test HTML</p>'
      );

      if (result.success) {
        expect(result.messageId).toBeDefined();
        expect(typeof result.messageId).toBe('string');
      }
    });

    it('should handle HTML content', async () => {
      const html = '<html><body><h1>Test</h1></body></html>';
      const result = await emailService.sendEmail(
        'test@example.com',
        'Test Subject',
        html
      );

      expect(result).toHaveProperty('success');
    });

    it('should handle empty HTML', async () => {
      const result = await emailService.sendEmail(
        'test@example.com',
        'Test Subject',
        ''
      );

      expect(result).toHaveProperty('success');
    });
  });

  describe('generateDigestHTML', () => {
    it('should generate digest HTML', () => {
      const summary = {
        title: 'Test Digest',
        dateRange: 'Jan 1 - Jan 15, 2024',
        keyThemes: ['AI', 'ML'],
        recommendations: ['Test recommendation']
      };

      const config = {
        recipientEmail: 'test@example.com',
        frequency: 'daily' as const,
        includePowerPoint: false,
        includeSocialPosts: false,
        includeStats: true,
        maxPapers: 10,
        days: 30
      };

      const html = emailService.generateDigestHTML(mockPapers, summary, config);
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
      expect(html).toContain('<html>');
      expect(html).toContain('<body>');
    });

    it('should include paper titles', () => {
      const summary = {
        title: 'Test Digest',
        dateRange: 'Jan 1 - Jan 15, 2024',
        keyThemes: ['AI'],
        recommendations: []
      };

      const config = {
        recipientEmail: 'test@example.com',
        frequency: 'daily' as const,
        includePowerPoint: false,
        includeSocialPosts: false,
        includeStats: false,
        maxPapers: 10,
        days: 30
      };

      const html = emailService.generateDigestHTML(mockPapers, summary, config);
      expect(html).toContain(mockPapers[0].title);
    });

    it('should include paper URLs', () => {
      const summary = {
        title: 'Test Digest',
        dateRange: 'Jan 1 - Jan 15, 2024',
        keyThemes: ['AI'],
        recommendations: []
      };

      const config = {
        recipientEmail: 'test@example.com',
        frequency: 'daily' as const,
        includePowerPoint: false,
        includeSocialPosts: false,
        includeStats: false,
        maxPapers: 10,
        days: 30
      };

      const html = emailService.generateDigestHTML(mockPapers, summary, config);
      expect(html).toContain(mockPapers[0].url);
    });

    it('should include statistics when enabled', () => {
      const summary = {
        title: 'Test Digest',
        dateRange: 'Jan 1 - Jan 15, 2024',
        keyThemes: ['AI'],
        recommendations: []
      };

      const config = {
        recipientEmail: 'test@example.com',
        frequency: 'daily' as const,
        includePowerPoint: false,
        includeSocialPosts: false,
        includeStats: true,
        maxPapers: 10,
        days: 30
      };

      const html = emailService.generateDigestHTML(mockPapers, summary, config);
      expect(html).toContain('Statistics');
    });

    it('should include recommendations when enabled', () => {
      const summary = {
        title: 'Test Digest',
        dateRange: 'Jan 1 - Jan 15, 2024',
        keyThemes: ['AI'],
        recommendations: ['Test recommendation']
      };

      const config = {
        recipientEmail: 'test@example.com',
        frequency: 'daily' as const,
        includePowerPoint: false,
        includeSocialPosts: true,
        includeStats: false,
        maxPapers: 10,
        days: 30
      };

      const html = emailService.generateDigestHTML(mockPapers, summary, config);
      expect(html).toContain('Recommendations');
    });
  });

  describe('generateDigestSummary', () => {
    it('should generate digest summary', async () => {
      const summary = await emailService.generateDigestSummary(mockPapers);
      expect(summary).toHaveProperty('title');
      expect(summary).toHaveProperty('dateRange');
      expect(summary).toHaveProperty('keyThemes');
      expect(summary).toHaveProperty('recommendations');
    });

    it('should extract key themes from tags', async () => {
      const summary = await emailService.generateDigestSummary(mockPapers);
      expect(Array.isArray(summary.keyThemes)).toBe(true);
    });

    it('should generate recommendations', async () => {
      const summary = await emailService.generateDigestSummary(mockPapers);
      expect(Array.isArray(summary.recommendations)).toBe(true);
    });

    it('should handle empty papers array', async () => {
      const summary = await emailService.generateDigestSummary([]);
      expect(summary).toHaveProperty('title');
      expect(summary).toHaveProperty('dateRange');
    });
  });

  describe('edge cases', () => {
    it('should handle long paper titles', async () => {
      const longTitlePapers = [
        {
          ...mockPapers[0],
          title: 'A'.repeat(500)
        }
      ];

      const summary = await emailService.generateDigestSummary(longTitlePapers);
      expect(summary).toBeDefined();
    });

    it('should handle papers without abstract', async () => {
      const noAbstractPapers = [
        {
          ...mockPapers[0],
          abstract: null
        }
      ];

      const summary = await emailService.generateDigestSummary(noAbstractPapers);
      expect(summary).toBeDefined();
    });

    it('should handle papers without tags', async () => {
      const noTagsPapers = [
        {
          ...mockPapers[0],
          tags: []
        }
      ];

      const summary = await emailService.generateDigestSummary(noTagsPapers);
      expect(summary).toBeDefined();
    });
  });
});
