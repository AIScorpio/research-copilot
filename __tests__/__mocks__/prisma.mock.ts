// Mock Prisma for tests
jest.mock('@/lib/db', () => ({
  prisma: {
    dailyDigestLog: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({
        id: 'test-id',
        dateCode: '2026-03-22',
        title: 'Test',
        content: 'Test',
        status: 'published'
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({}),
    },
    digestGenerationLock: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    paper: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn((callback) => callback({
      dailyDigestLog: {
        upsert: jest.fn().mockResolvedValue({
          id: 'test-id',
          dateCode: '2026-03-22',
          title: 'Test',
          content: 'Test',
          status: 'published'
        })
      }
    }))
  }
}));
