import { jest } from '@jest/globals';

jest.mock('@/lib/collector', () => ({
  searchOnline: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/lib/query-optimizer', () => ({
  optimizeQuery: jest.fn().mockResolvedValue({ optimizedQuery: 'AI AND banking', originalQuery: 'AI in banking', source: 'llm' }),
}));
jest.mock('@/lib/content-filter', () => ({
  checkContentRelevance: jest.fn().mockResolvedValue({
    isRelevant: true,
    relevanceScore: 7.5,
    confidence: 0.9,
    reasoning: 'Relevant to AI in banking',
    matchedCategories: ['ai-technology'],
    suggestedTags: [{ name: 'ai', category: 'ai-technology' }],
    dimensionScores: { technical: 7, business: 8, timeliness: 6, practicality: 7 },
    technicalBonusApplied: false,
  }),
}));
jest.mock('@/lib/processor', () => ({
  processPaper: jest.fn().mockResolvedValue({
    title: 'Test Paper',
    abstract: 'Test abstract',
    url: 'https://example.com/test',
    source: 'ArXiv',
    publicationDate: '2026-04-01T00:00:00.000Z',
    suggestedTags: [{ name: 'ai', category: 'ai-technology' }, { name: 'banking', category: 'business-area' }],
  }),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/daily-digest/engine', () => ({
  digestEngine: { triggerDailyDigestUpdate: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@/lib/timezone-utils', () => ({
  getBeijingDateCode: jest.fn().mockReturnValue('2026-04-12'),
}));
jest.mock('@/lib/source-type-service', () => ({
  inferSourceTypeFromName: jest.fn().mockResolvedValue('academic'),
}));
jest.mock('@/lib/collection-config', () => ({
  loadCollectionConfig: jest.fn().mockResolvedValue({ maxResults: 20, autoTimeRangeDays: 7, autoDefaultQuery: 'AI in banking' }),
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
    logPaperDetails: jest.fn(), logCollectionSummary: jest.fn(),
    withRunContext: jest.fn((_: string, __: string, fn: () => any) => fn()),
    getRunContext: jest.fn(),
  },
}));

const { prisma } = require('@/lib/db');

function makeSearchResult(overrides: Record<string, any> = {}) {
  return {
    title: overrides.title || 'Test Paper',
    abstract: overrides.abstract || 'Test abstract',
    url: overrides.url || `https://example.com/paper-${Math.random().toString(36).slice(2)}`,
    source: overrides.source || 'ArXiv',
    publicationDate: overrides.publicationDate || '2026-04-01T00:00:00.000Z',
  };
}

function makeMockTx() {
  return {
    paper: { create: jest.fn() },
    tag: { upsert: jest.fn() },
    paperTag: { create: jest.fn() },
  };
}

function setupTxWithSuccess(tx: ReturnType<typeof makeMockTx>) {
  tx.paper.create.mockResolvedValue({
    id: 'paper-1', title: 'Test', abstract: 'Abstract',
    url: 'https://example.com/test', source: 'ArXiv', sourceType: 'academic',
    publicationDate: new Date(), collectedAt: new Date(),
    relevanceScore: 7.5, technicalScore: 7, businessScore: 8,
    timelinessScore: 6, practicalityScore: 7, assessmentReason: 'Relevant',
    technicalBonusApplied: false,
  });
  tx.tag.upsert.mockImplementation((args: any) => Promise.resolve({
    id: `tag-${args.where.name}`, name: args.where.name, category: args.create.category,
  }));
  tx.paperTag.create.mockResolvedValue({});
}

function setupCollection(sources: any[], papers: any[]) {
  jest.spyOn(prisma.source, 'findMany').mockResolvedValue(sources);
  jest.spyOn(prisma.paper, 'findMany').mockResolvedValue(papers);
}

function setupTx(tx: ReturnType<typeof makeMockTx>) {
  return jest.spyOn(prisma, '$transaction').mockImplementation(
    (cb: any) => cb(tx),
  );
}

describe('Collection Service - Transaction Wrapping', () => {
  beforeEach(() => jest.restoreAllMocks());

  describe('T1: Normal save - paper + tags in transaction', () => {
    it('should create paper and tags within a single transaction', async () => {
      const { runCollection } = require('../../src/lib/collection-service');
      const { searchOnline } = require('../../src/lib/collector');

      searchOnline.mockResolvedValue([makeSearchResult({ url: 'https://example.com/t1' })]);
      const tx = makeMockTx();
      setupTxWithSuccess(tx);
      setupCollection([{ name: 'ArXiv', enabled: true }], []);
      setupTx(tx);

      const response = await runCollection({ mode: 'auto', query: 'AI in banking' });

      expect(response.success).toBe(true);
      expect(response.newCount).toBe(1);
      expect(tx.paper.create).toHaveBeenCalledTimes(1);
      expect(tx.tag.upsert).toHaveBeenCalledTimes(2);
      expect(tx.paperTag.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('T2: Tag already exists - upsert reuses existing tag', () => {
    it('should use upsert for tags (atomic find-or-create)', async () => {
      const { runCollection } = require('../../src/lib/collection-service');
      const { searchOnline } = require('../../src/lib/collector');

      searchOnline.mockResolvedValue([makeSearchResult({ url: 'https://example.com/t2' })]);
      const tx = makeMockTx();
      setupTxWithSuccess(tx);
      tx.tag.upsert.mockResolvedValue({ id: 'existing-tag-id', name: 'ai', category: 'ai-technology' });
      setupCollection([{ name: 'ArXiv', enabled: true }], []);
      setupTx(tx);

      const response = await runCollection({ mode: 'auto', query: 'AI in banking' });

      expect(response.success).toBe(true);
      expect(tx.tag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { name: 'ai' } }),
      );
    });
  });

  describe('T3: processPaper returns empty tags - paper still saves', () => {
    it('should save paper with no tags when processPaper returns empty array', async () => {
      const { runCollection } = require('../../src/lib/collection-service');
      const { searchOnline } = require('../../src/lib/collector');
      const { processPaper } = require('../../src/lib/processor');

      searchOnline.mockResolvedValue([makeSearchResult({ url: 'https://example.com/t3' })]);
      processPaper.mockResolvedValueOnce({
        ...makeSearchResult({ url: 'https://example.com/t3' }),
        suggestedTags: [],
      });
      const tx = makeMockTx();
      setupTxWithSuccess(tx);
      setupCollection([{ name: 'ArXiv', enabled: true }], []);
      setupTx(tx);

      const response = await runCollection({ mode: 'auto', query: 'AI in banking' });

      expect(response.success).toBe(true);
      expect(response.newCount).toBe(1);
      expect(tx.paper.create).toHaveBeenCalledTimes(1);
      expect(tx.tag.upsert).not.toHaveBeenCalled();
      expect(tx.paperTag.create).not.toHaveBeenCalled();
    });
  });

  describe('T4: paper.create fails - transaction rollback, other papers continue', () => {
    it('should rollback first paper and save second paper successfully', async () => {
      const { runCollection } = require('../../src/lib/collection-service');
      const { searchOnline } = require('../../src/lib/collector');

      searchOnline.mockResolvedValue([
        makeSearchResult({ url: 'https://example.com/t4a', title: 'First Paper' }),
        makeSearchResult({ url: 'https://example.com/t4b', title: 'Second Paper' }),
      ]);

      let callCount = 0;
      const tx = makeMockTx();
      tx.paper.create.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const err: any = new Error('Unique constraint failed');
          err.code = 'P2002';
          return Promise.reject(err);
        }
        return Promise.resolve({
          id: 'paper-2', title: 'Second Paper', abstract: 'Abstract',
          url: 'https://example.com/t4b', source: 'ArXiv', sourceType: 'academic',
          publicationDate: new Date(), collectedAt: new Date(),
          relevanceScore: 7.5, technicalScore: 7, businessScore: 8,
          timelinessScore: 6, practicalityScore: 7, assessmentReason: 'Relevant',
          technicalBonusApplied: false,
        });
      });
      tx.tag.upsert.mockResolvedValue({ id: 't', name: 'n', category: 'c' });
      tx.paperTag.create.mockResolvedValue({});
      setupCollection([{ name: 'ArXiv', enabled: true }], []);
      setupTx(tx);

      const response = await runCollection({ mode: 'auto', query: 'AI in banking' });

      expect(response.success).toBe(true);
      expect(response.errors.length).toBeGreaterThan(0);
      expect(response.errors[0]).toContain('Failed to save paper');
      expect(callCount).toBe(2);
      expect(response.newCount).toBe(1);
    });
  });

  describe('T5: Tag upsert fails - full transaction rollback', () => {
    it('should rollback paper creation when tag operation fails', async () => {
      const { runCollection } = require('../../src/lib/collection-service');
      const { searchOnline } = require('../../src/lib/collector');

      searchOnline.mockResolvedValue([makeSearchResult({ url: 'https://example.com/t5' })]);
      const tx = makeMockTx();
      tx.paper.create.mockResolvedValue({ id: 'paper-1', title: 'Test' });
      tx.tag.upsert.mockRejectedValue(new Error('DB connection lost'));
      setupCollection([{ name: 'ArXiv', enabled: true }], []);
      setupTx(tx);

      const response = await runCollection({ mode: 'auto', query: 'AI in banking' });

      expect(response.success).toBe(true);
      expect(response.errors.length).toBe(1);
      expect(response.errors[0]).toContain('Failed to save paper');
      expect(tx.paper.create).toHaveBeenCalled();
    });
  });

  describe('T6: Duplicate tag names from LLM - deduplication prevents constraint error', () => {
    it('should deduplicate tags by name before entering transaction', async () => {
      const { runCollection } = require('../../src/lib/collection-service');
      const { searchOnline } = require('../../src/lib/collector');
      const { processPaper } = require('../../src/lib/processor');

      searchOnline.mockResolvedValue([makeSearchResult({ url: 'https://example.com/t6' })]);
      processPaper.mockResolvedValueOnce({
        ...makeSearchResult({ url: 'https://example.com/t6' }),
        suggestedTags: [
          { name: 'deep-learning', category: 'ai-technology' },
          { name: 'deep-learning', category: 'methodology' },
          { name: 'neural-networks', category: 'ai-technology' },
        ],
      });
      const tx = makeMockTx();
      setupTxWithSuccess(tx);
      setupCollection([{ name: 'ArXiv', enabled: true }], []);
      setupTx(tx);

      const response = await runCollection({ mode: 'auto', query: 'AI in banking' });

      expect(response.success).toBe(true);
      expect(response.errors.length).toBe(0);
      const upsertNames = tx.tag.upsert.mock.calls.map((c: any) => c[0].where.name);
      expect(upsertNames).toEqual(['deep-learning', 'neural-networks']);
      expect(upsertNames.length).toBe(2);
    });
  });

  describe('T7: Empty tags - transaction succeeds with paper only', () => {
    it('should create paper without any tag operations', async () => {
      const { runCollection } = require('../../src/lib/collection-service');
      const { searchOnline } = require('../../src/lib/collector');
      const { processPaper } = require('../../src/lib/processor');

      searchOnline.mockResolvedValue([makeSearchResult({ url: 'https://example.com/t7' })]);
      processPaper.mockResolvedValueOnce({
        ...makeSearchResult({ url: 'https://example.com/t7' }),
        suggestedTags: [],
      });
      const tx = makeMockTx();
      setupTxWithSuccess(tx);
      setupCollection([{ name: 'ArXiv', enabled: true }], []);
      setupTx(tx);

      const response = await runCollection({ mode: 'auto', query: 'AI in banking' });

      expect(response.success).toBe(true);
      expect(response.errors.length).toBe(0);
      expect(tx.paper.create).toHaveBeenCalledTimes(1);
      expect(tx.tag.upsert).not.toHaveBeenCalled();
      expect(tx.paperTag.create).not.toHaveBeenCalled();
    });
  });

  describe('Transaction boundary verification', () => {
    it('should NOT use root prisma.paper.create (only tx.paper.create)', async () => {
      const { runCollection } = require('../../src/lib/collection-service');
      const { searchOnline } = require('../../src/lib/collector');
      const paperCreateSpy = jest.spyOn(prisma.paper, 'create');
      const tagFindUniqueSpy = jest.spyOn(prisma.tag, 'findUnique');
      const tagCreateSpy = jest.spyOn(prisma.tag, 'create');
      const paperTagCreateSpy = jest.spyOn(prisma.paperTag, 'create');

      searchOnline.mockResolvedValue([makeSearchResult({ url: 'https://example.com/boundary' })]);
      const tx = makeMockTx();
      setupTxWithSuccess(tx);
      setupCollection([{ name: 'ArXiv', enabled: true }], []);
      setupTx(tx);

      await runCollection({ mode: 'auto', query: 'AI in banking' });

      expect(tx.paper.create).toHaveBeenCalledTimes(1);
      expect(tx.tag.upsert).toHaveBeenCalledTimes(2);
      expect(tx.paperTag.create).toHaveBeenCalledTimes(2);

      expect(paperCreateSpy).not.toHaveBeenCalled();
      expect(tagFindUniqueSpy).not.toHaveBeenCalled();
      expect(tagCreateSpy).not.toHaveBeenCalled();
      expect(paperTagCreateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Tag deduplication - 8 tags with duplicates, limit 5', () => {
    it('should dedup first, then slice to 5, preserving last occurrence', async () => {
      const { runCollection } = require('../../src/lib/collection-service');
      const { searchOnline } = require('../../src/lib/collector');
      const { processPaper } = require('../../src/lib/processor');

      searchOnline.mockResolvedValue([makeSearchResult({ url: 'https://example.com/dedup8' })]);
      processPaper.mockResolvedValueOnce({
        ...makeSearchResult({ url: 'https://example.com/dedup8' }),
        suggestedTags: [
          { name: 'a', category: 'cat1' },
          { name: 'b', category: 'cat2' },
          { name: 'a', category: 'cat3' },
          { name: 'c', category: 'cat4' },
          { name: 'b', category: 'cat5' },
          { name: 'd', category: 'cat6' },
          { name: 'e', category: 'cat7' },
          { name: 'f', category: 'cat8' },
        ],
      });
      const tx = makeMockTx();
      setupTxWithSuccess(tx);
      setupCollection([{ name: 'ArXiv', enabled: true }], []);
      setupTx(tx);

      await runCollection({ mode: 'auto', query: 'AI in banking' });

      const upsertNames = tx.tag.upsert.mock.calls.map((c: any) => c[0].where.name);
      expect(upsertNames).toEqual(['a', 'b', 'c', 'd', 'e']);
      expect(upsertNames.length).toBe(5);
    });
  });

  describe('Per-paper transaction isolation', () => {
    it('should create separate transactions for each paper', async () => {
      const { runCollection } = require('../../src/lib/collection-service');
      const { searchOnline } = require('../../src/lib/collector');

      searchOnline.mockResolvedValue([
        makeSearchResult({ url: 'https://example.com/multi-1', title: 'Paper One' }),
        makeSearchResult({ url: 'https://example.com/multi-2', title: 'Paper Two' }),
        makeSearchResult({ url: 'https://example.com/multi-3', title: 'Paper Three' }),
      ]);

      const txClients: any[] = [];
      setupCollection([{ name: 'ArXiv', enabled: true }], []);
      jest.spyOn(prisma, '$transaction').mockImplementation(
        (cb: any) => {
          const tx = makeMockTx();
          setupTxWithSuccess(tx);
          txClients.push(tx);
          return cb(tx);
        },
      );

      const response = await runCollection({ mode: 'auto', query: 'AI in banking' });

      expect(response.success).toBe(true);
      expect(response.newCount).toBe(3);
      txClients.forEach((tx) => {
        expect(tx.paper.create).toHaveBeenCalledTimes(1);
      });
    });
  });
});
