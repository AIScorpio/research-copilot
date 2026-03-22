import { jest } from '@jest/globals';

// Manual mock for @/lib/db
export const prisma = {
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
