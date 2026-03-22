// Test helper to setup Prisma mocks
import { jest } from '@jest/globals';

export function setupPrismaMocks() {
  const mockPrisma = {
    dailyDigestLog: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
    digestGenerationLock: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    paper: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  jest.mock('@/lib/db', () => ({
    prisma: mockPrisma,
  }));

  return mockPrisma;
}

export const defaultMockReturnValues = {
  dailyDigestLog: {
    findUnique: null,
    findMany: [],
    upsert: {
      id: 'test-id',
      dateCode: '2026-03-22',
      title: 'Test Digest',
      subtitle: null,
      content: 'Test content',
      type: 'DailyDigest',
      actualCount: 0,
      totalCount: 0,
      status: 'published',
      qualityScore: 9.5,
      validationIssues: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      papers: []
    },
    deleteMany: { count: 0 },
    update: {},
  },
  paper: {
    findMany: [],
  },
  digestGenerationLock: {
    findUnique: null,
    create: {},
    update: {},
    delete: {},
  },
  $transaction: (callback: any) => callback({
    dailyDigestLog: {
      upsert: jest.fn().mockResolvedValue({
        id: 'test-id',
        dateCode: '2026-03-22',
        title: 'Test Digest',
        content: 'Test content',
        status: 'published',
        papers: []
      })
    }
  }),
};

export function setupDefaultMockReturnValues(prisma: any) {
  prisma.dailyDigestLog.findUnique.mockResolvedValue(defaultMockReturnValues.dailyDigestLog.findUnique);
  prisma.dailyDigestLog.findMany.mockResolvedValue(defaultMockReturnValues.dailyDigestLog.findMany);
  prisma.dailyDigestLog.upsert.mockResolvedValue(defaultMockReturnValues.dailyDigestLog.upsert);
  prisma.dailyDigestLog.deleteMany.mockResolvedValue(defaultMockReturnValues.dailyDigestLog.deleteMany);
  prisma.dailyDigestLog.update.mockResolvedValue(defaultMockReturnValues.dailyDigestLog.update);
  prisma.paper.findMany.mockResolvedValue(defaultMockReturnValues.paper.findMany);
  prisma.digestGenerationLock.findUnique.mockResolvedValue(defaultMockReturnValues.digestGenerationLock.findUnique);
  prisma.digestGenerationLock.create.mockResolvedValue(defaultMockReturnValues.digestGenerationLock.create);
  prisma.digestGenerationLock.update.mockResolvedValue(defaultMockReturnValues.digestGenerationLock.update);
  prisma.digestGenerationLock.delete.mockResolvedValue(defaultMockReturnValues.digestGenerationLock.delete);
  prisma.$transaction.mockImplementation(defaultMockReturnValues.$transaction);
}
