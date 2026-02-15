import { generatePowerPoint } from '@/lib/ppt-generator';

describe('PowerPoint Generator', () => {
  const mockPapers = [
    {
      id: '1',
      title: 'AI in Banking',
      abstract: 'This paper discusses AI applications in banking.',
      url: 'https://example.com/paper1',
      source: 'ArXiv',
      publicationDate: new Date('2024-01-01'),
      tags: [{ id: '1', name: 'AI', type: 'topic' }],
      aiSummary: 'AI is revolutionizing banking.'
    },
    {
      id: '2',
      title: 'Machine Learning for Risk',
      abstract: 'Using ML for risk assessment.',
      url: 'https://example.com/paper2',
      source: 'IEEE',
      publicationDate: new Date('2024-01-15'),
      tags: [{ id: '2', name: 'ML', type: 'topic' }],
      aiSummary: 'ML improves risk prediction.'
    }
  ];

  describe('generatePowerPoint', () => {
    it('should generate PowerPoint buffer', async () => {
      const buffer = await generatePowerPoint(mockPapers);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle empty papers array', async () => {
      const buffer = await generatePowerPoint([]);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('should accept custom title option', async () => {
      const buffer = await generatePowerPoint(mockPapers, {
        title: 'Custom Title'
      });
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('should accept maxPapers option', async () => {
      const buffer = await generatePowerPoint(mockPapers, {
        maxPapers: 1
      });
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('should handle includeAbstract option', async () => {
      const buffer = await generatePowerPoint(mockPapers, {
        includeAbstract: false
      });
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('should handle includeSummary option', async () => {
      const buffer = await generatePowerPoint(mockPapers, {
        includeSummary: false
      });
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('should handle includeTags option', async () => {
      const buffer = await generatePowerPoint(mockPapers, {
        includeTags: false
      });
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('should handle all custom options', async () => {
      const buffer = await generatePowerPoint(mockPapers, {
        title: 'Test Presentation',
        subtitle: 'Test Subtitle',
        author: 'Test Author',
        maxPapers: 2,
        includeAbstract: true,
        includeSummary: true,
        includeTags: true
      });
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });

  describe('paper without tags', () => {
    it('should handle papers without tags', async () => {
      const papersWithoutTags = [
        {
          id: '1',
          title: 'No Tags Paper',
          abstract: 'This paper has no tags.',
          url: 'https://example.com',
          source: 'ArXiv',
          publicationDate: new Date('2024-01-01')
        }
      ];

      const buffer = await generatePowerPoint(papersWithoutTags);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });

  describe('paper without abstract', () => {
    it('should handle papers without abstract', async () => {
      const papersWithoutAbstract = [
        {
          id: '1',
          title: 'No Abstract Paper',
          url: 'https://example.com',
          source: 'ArXiv',
          publicationDate: new Date('2024-01-01'),
          tags: [{ id: '1', name: 'AI', type: 'topic' }]
        }
      ];

      const buffer = await generatePowerPoint(papersWithoutAbstract);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });

  describe('date formats', () => {
    it('should handle string dates', async () => {
      const papersWithStringDates = [
        {
          id: '1',
          title: 'String Date Paper',
          abstract: 'Test',
          url: 'https://example.com',
          source: 'ArXiv',
          publicationDate: '2024-01-01',
          tags: [{ id: '1', name: 'AI', type: 'topic' }]
        }
      ];

      const buffer = await generatePowerPoint(papersWithStringDates);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });
});
