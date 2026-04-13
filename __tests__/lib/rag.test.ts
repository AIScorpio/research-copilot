import { jest } from '@jest/globals';

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const { prisma } = require('@/lib/db');
const { loadPaperCorpus, buildSystemPrompt, extractSources, getContextMode } = require('@/lib/rag');

const mockPapers = [
  {
    id: '1',
    title: 'Paper One',
    url: 'https://example.com/paper1',
    abstract: 'Abstract for paper one',
    relevanceScore: 9.0,
    technicalScore: 8.5,
    businessScore: 7.0,
    timelinessScore: 9.0,
    practicalityScore: 8.0,
    publicationDate: new Date('2024-01-15'),
    collectedAt: new Date('2024-02-01'),
    assessmentReason: 'Highly relevant to fraud detection',
    source: 'arxiv',
    deletedAt: null,
    tags: [{ tag: { name: 'fraud-detection' } }, { tag: { name: 'deep-learning' } }],
  },
  {
    id: '2',
    title: 'Paper Two',
    url: 'https://example.com/paper2',
    abstract: 'Abstract for paper two',
    relevanceScore: 7.5,
    technicalScore: 6.0,
    businessScore: 8.0,
    timelinessScore: 7.0,
    practicalityScore: 9.0,
    publicationDate: new Date('2024-03-10'),
    collectedAt: new Date('2024-03-15'),
    assessmentReason: '',
    source: 'semantic-scholar',
    deletedAt: null,
    tags: [{ tag: { name: 'credit-scoring' } }],
  },
  {
    id: '3',
    title: 'Paper Three',
    url: 'https://example.com/paper3',
    abstract: null,
    relevanceScore: 5.0,
    technicalScore: 5.0,
    businessScore: 5.0,
    timelinessScore: 5.0,
    practicalityScore: 5.0,
    publicationDate: null,
    collectedAt: new Date('2024-06-01'),
    assessmentReason: null,
    source: 'unknown',
    deletedAt: null,
    tags: [],
  },
];

describe('RAG Module', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('loadPaperCorpus', () => {
    it('should return compact markdown without abstracts for mode=compact', async () => {
      jest.spyOn(prisma.paper, 'findMany').mockResolvedValue(mockPapers as any);

      const result = await loadPaperCorpus('compact');

      expect(result.paperCount).toBe(3);
      expect(result.dateRange).toBe('2024-01-15 to 2024-06-01');
      expect(result.markdown).toContain('## Paper 1');
      expect(result.markdown).toContain('**Title:** Paper One');
      expect(result.markdown).toContain('**Tags:** fraud-detection, deep-learning');
      expect(result.markdown).toContain('**Source:** arxiv | **Collected:** 2024-02-01');
      expect(result.markdown).toContain('**URL:** https://example.com/paper1');
      expect(result.markdown).toContain('**Why collected:** Highly relevant to fraud detection');
      expect(result.markdown).not.toContain('**Abstract:**');
    });

    it('should include abstracts for mode=full', async () => {
      jest.spyOn(prisma.paper, 'findMany').mockResolvedValue(mockPapers as any);

      const result = await loadPaperCorpus('full');

      expect(result.paperCount).toBe(3);
      expect(result.markdown).toContain('**Abstract:** Abstract for paper one');
      expect(result.markdown).toContain('**Abstract:** Abstract for paper two');
      expect(result.markdown).not.toContain('**Abstract:** null');
    });

    it('should return empty markdown for 0 papers', async () => {
      jest.spyOn(prisma.paper, 'findMany').mockResolvedValue([]);

      const result = await loadPaperCorpus('compact');

      expect(result.markdown).toBe('');
      expect(result.paperCount).toBe(0);
      expect(result.dateRange).toBe('N/A');
    });
  });

  describe('buildSystemPrompt', () => {
    it('should contain empty message when paperCount is 0', () => {
      const corpusInfo = { markdown: '', paperCount: 0, dateRange: 'N/A' };
      const prompt = buildSystemPrompt(corpusInfo);

      expect(prompt).toContain('empty');
      expect(prompt).toContain('research intelligence assistant');
      expect(prompt).toContain('risk-management');
    });

    it('should contain paper count, focus areas, and rules when papers exist', () => {
      const corpusInfo = { markdown: '## Paper 1', paperCount: 5, dateRange: '2024-01-01 to 2024-06-01' };
      const prompt = buildSystemPrompt(corpusInfo);

      expect(prompt).toContain('5 papers');
      expect(prompt).toContain('2024-01-01 to 2024-06-01');
      expect(prompt).toContain('RULES');
      expect(prompt).toContain('risk-management');
      expect(prompt).toContain('compliance');
      expect(prompt).toContain('fraud-detection');
      expect(prompt).toContain('CAPABILITIES');
    });
  });

  describe('extractSources', () => {
    it('should extract sources from bold markdown links', async () => {
      jest.spyOn(prisma.paper, 'findMany').mockResolvedValue([mockPapers[0], mockPapers[1]] as any);

      const responseContent = 'Based on papers: **[Paper One](https://example.com/paper1)** and **[Paper Two](https://example.com/paper2)**';
      const sources = await extractSources(responseContent);

      expect(sources).toHaveLength(2);
      expect(sources[0].id).toBe('1');
      expect(sources[0].title).toBe('Paper One');
      expect(sources[0].url).toBe('https://example.com/paper1');
      expect(sources[1].id).toBe('2');
      expect(sources[1].title).toBe('Paper Two');
    });

    it('should return empty array when no links found', async () => {
      const findManySpy = jest.spyOn(prisma.paper, 'findMany').mockResolvedValue([]);

      const sources = await extractSources('No links in this response');

      expect(sources).toEqual([]);
      expect(findManySpy).not.toHaveBeenCalled();
    });

    it('should extract sources from plain markdown links without bold', async () => {
      jest.spyOn(prisma.paper, 'findMany').mockResolvedValue([mockPapers[2]] as any);

      const responseContent = 'See [Paper Three](https://example.com/paper3) for details';
      const sources = await extractSources(responseContent);

      expect(sources).toHaveLength(1);
      expect(sources[0].title).toBe('Paper Three');
      expect(sources[0].url).toBe('https://example.com/paper3');
    });
  });

  describe('getContextMode', () => {
    it('should return compact for context window under 256000', () => {
      expect(getContextMode(128000)).toBe('compact');
    });

    it('should return full for context window at or above 256000', () => {
      expect(getContextMode(300000)).toBe('full');
    });
  });
});
