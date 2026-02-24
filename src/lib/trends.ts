import { prisma } from './db';

export type PeriodType = 'week' | 'month' | 'quarter' | 'year';
export type TrendDirection = 'up' | 'down' | 'flat';

export interface TrendDataPoint {
  date: Date;
  count: number;
}

export interface TrendMetrics {
  currentCount: number;
  previousCount: number;
  growthRate: number;
  percentChange: number;
  direction: TrendDirection;
  trendData: TrendDataPoint[];
}

export interface TrendingTopic {
  tagId: string;
  tagName: string;
  tagCategory?: string | null;
  growthRate: number;
  percentChange: number;
  direction: TrendDirection;
  currentCount: number;
  previousCount: number;
  trendData: TrendDataPoint[];
}

export interface TrendQuery {
  tagIds?: string[];
  period?: PeriodType;
  days?: number;
  startDate?: Date;
  endDate?: Date;
}

export async function getTrendData(
  tagId: string,
  startDate: Date,
  endDate: Date
): Promise<TrendDataPoint[]> {
  const trendData = await prisma.trendData.findMany({
    where: {
      tagId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      date: 'asc',
    },
  });

  return trendData.map((d) => ({
    date: d.date,
    count: d.count,
  }));
}

export async function calculateTrend(
  tagId: string,
  period: PeriodType = 'month'
): Promise<TrendMetrics> {
  const now = new Date();
  const { startDate: periodStart, previousPeriodStart } = getDateRanges(now, period);

  const [currentTrendData, previousTrendData] = await Promise.all([
    getTrendData(tagId, periodStart, now),
    getTrendData(tagId, previousPeriodStart, periodStart),
  ]);

  const currentCount = currentTrendData.reduce((sum, d) => sum + d.count, 0);
  const previousCount = previousTrendData.reduce((sum, d) => sum + d.count, 0);

  const growthRate = previousCount > 0 ? (currentCount - previousCount) / previousCount : 0;
  const percentChange = growthRate * 100;

  let direction: TrendDirection = 'flat';
  if (percentChange > 5) direction = 'up';
  else if (percentChange < -5) direction = 'down';

  return {
    currentCount,
    previousCount,
    growthRate,
    percentChange,
    direction,
    trendData: currentTrendData,
  };
}

export async function getMultipleTrends(
  tagIds: string[],
  period: PeriodType = 'month'
): Promise<Map<string, TrendMetrics>> {
  const trendPromises = tagIds.map((tagId) => calculateTrend(tagId, period));
  const trends = await Promise.all(trendPromises);

  const resultMap = new Map<string, TrendMetrics>();
  tagIds.forEach((tagId, index) => {
    resultMap.set(tagId, trends[index]);
  });

  return resultMap;
}

export async function identifyTrendingTopics(
  period: PeriodType = 'month',
  limit: number = 10
): Promise<TrendingTopic[]> {
  const now = new Date();
  const { startDate: periodStart, previousPeriodStart } = getDateRanges(now, period);

  const allTags = await prisma.tag.findMany({
    include: {
      _count: {
        select: { papers: true },
      },
    },
  });

  const tagIds = allTags.map(tag => tag.id);

  const [currentTrendData, previousTrendData] = await Promise.all([
    prisma.trendData.findMany({
      where: {
        tagId: { in: tagIds },
        date: {
          gte: periodStart,
          lte: now,
        },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.trendData.findMany({
      where: {
        tagId: { in: tagIds },
        date: {
          gte: previousPeriodStart,
          lte: periodStart,
        },
      },
      orderBy: { date: 'asc' },
    }),
  ]);

  const currentTrendMap = new Map<string, TrendDataPoint[]>();
  currentTrendData.forEach(d => {
    if (!currentTrendMap.has(d.tagId)) {
      currentTrendMap.set(d.tagId, []);
    }
    currentTrendMap.get(d.tagId)!.push({ date: d.date, count: d.count });
  });

  const previousTrendMap = new Map<string, TrendDataPoint[]>();
  previousTrendData.forEach(d => {
    if (!previousTrendMap.has(d.tagId)) {
      previousTrendMap.set(d.tagId, []);
    }
    previousTrendMap.get(d.tagId)!.push({ date: d.date, count: d.count });
  });

  const allTrends = allTags.map(tag => {
    const currentData = currentTrendMap.get(tag.id) || [];
    const previousData = previousTrendMap.get(tag.id) || [];

    const currentCount = currentData.reduce((sum, d) => sum + d.count, 0);
    const previousCount = previousData.reduce((sum, d) => sum + d.count, 0);

    const growthRate = previousCount > 0 ? (currentCount - previousCount) / previousCount : 0;
    const percentChange = growthRate * 100;

    let direction: TrendDirection = 'flat';
    if (percentChange > 5) direction = 'up';
    else if (percentChange < -5) direction = 'down';

    return {
      tagId: tag.id,
      tagName: tag.name,
      tagCategory: tag.category,
      growthRate,
      percentChange,
      direction,
      currentCount,
      previousCount,
      trendData: currentData,
    };
  });

  const trending = allTrends
    .filter((t) => t.direction === 'up' && t.currentCount > 0)
    .sort((a, b) => b.growthRate - a.growthRate)
    .slice(0, limit);

  const declining = allTrends
    .filter((t) => t.direction === 'down' && t.currentCount > 0)
    .sort((a, b) => a.growthRate - b.growthRate)
    .slice(0, limit);

  return [...trending, ...declining];
}

export async function getAllTrends(
  period: PeriodType = 'month',
  direction?: TrendDirection
): Promise<TrendingTopic[]> {
  const now = new Date();
  const { startDate: periodStart, previousPeriodStart } = getDateRanges(now, period);

  const allTags = await prisma.tag.findMany();
  const tagIds = allTags.map(tag => tag.id);

  const [currentTrendData, previousTrendData] = await Promise.all([
    prisma.trendData.findMany({
      where: {
        tagId: { in: tagIds },
        date: {
          gte: periodStart,
          lte: now,
        },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.trendData.findMany({
      where: {
        tagId: { in: tagIds },
        date: {
          gte: previousPeriodStart,
          lte: periodStart,
        },
      },
      orderBy: { date: 'asc' },
    }),
  ]);

  const currentTrendMap = new Map<string, TrendDataPoint[]>();
  currentTrendData.forEach(d => {
    if (!currentTrendMap.has(d.tagId)) {
      currentTrendMap.set(d.tagId, []);
    }
    currentTrendMap.get(d.tagId)!.push({ date: d.date, count: d.count });
  });

  const previousTrendMap = new Map<string, TrendDataPoint[]>();
  previousTrendData.forEach(d => {
    if (!previousTrendMap.has(d.tagId)) {
      previousTrendMap.set(d.tagId, []);
    }
    previousTrendMap.get(d.tagId)!.push({ date: d.date, count: d.count });
  });

  const allTrends = allTags.map(tag => {
    const currentData = currentTrendMap.get(tag.id) || [];
    const previousData = previousTrendMap.get(tag.id) || [];

    const currentCount = currentData.reduce((sum, d) => sum + d.count, 0);
    const previousCount = previousData.reduce((sum, d) => sum + d.count, 0);

    const growthRate = previousCount > 0 ? (currentCount - previousCount) / previousCount : 0;
    const percentChange = growthRate * 100;

    let trendDirection: TrendDirection = 'flat';
    if (percentChange > 5) trendDirection = 'up';
    else if (percentChange < -5) trendDirection = 'down';

    return {
      tagId: tag.id,
      tagName: tag.name,
      tagCategory: tag.category,
      growthRate,
      percentChange,
      direction: trendDirection,
      currentCount,
      previousCount,
      trendData: currentData,
    };
  });

  if (direction) {
    return allTrends.filter((t) => t.direction === direction);
  }

  return allTrends;
}

export function getDateRanges(
  referenceDate: Date,
  period: PeriodType
): { startDate: Date; previousPeriodStart: Date; previousPeriodEnd: Date } {
  const startDate = new Date(referenceDate);
  const previousPeriodEnd = new Date(startDate);
  const previousPeriodStart = new Date(startDate);

  switch (period) {
    case 'week':
      startDate.setDate(referenceDate.getDate() - 7);
      previousPeriodEnd.setDate(referenceDate.getDate() - 7);
      previousPeriodStart.setDate(referenceDate.getDate() - 14);
      break;

    case 'month':
      startDate.setMonth(referenceDate.getMonth() - 1);
      previousPeriodEnd.setMonth(referenceDate.getMonth() - 1);
      previousPeriodStart.setMonth(referenceDate.getMonth() - 2);
      break;

    case 'quarter':
      startDate.setMonth(referenceDate.getMonth() - 3);
      previousPeriodEnd.setMonth(referenceDate.getMonth() - 3);
      previousPeriodStart.setMonth(referenceDate.getMonth() - 6);
      break;

    case 'year':
      startDate.setFullYear(referenceDate.getFullYear() - 1);
      previousPeriodEnd.setFullYear(referenceDate.getFullYear() - 1);
      previousPeriodStart.setFullYear(referenceDate.getFullYear() - 2);
      break;
  }

  return { startDate, previousPeriodStart, previousPeriodEnd };
}

export async function updateDailyTrendData(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allTags = await prisma.tag.findMany();

  for (const tag of allTags) {
    const count = await prisma.paper.count({
      where: {
        tags: {
          some: {
            tagId: tag.id,
          },
        }
      },
    });

    await prisma.trendData.upsert({
      where: {
        tagId_date: {
          tagId: tag.id,
          date: today,
        },
      },
      update: {
        count,
      },
      create: {
        tagId: tag.id,
        date: today,
        count,
      },
    });
  }
}

export async function backfillTrendData(
  startDate?: Date,
  endDate?: Date
): Promise<{ processed: number; created: number; updated: number }> {
  const end = endDate || new Date();
  const start = startDate || new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const allTags = await prisma.tag.findMany();

  let processed = 0;
  let created = 0;
  let updated = 0;

  const currentDate = new Date(start);
  while (currentDate <= end) {
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);

    for (const tag of allTags) {
      processed++;

      const papersWithTag = await prisma.paper.count({
        where: {
          publicationDate: {
            gte: currentDate,
            lt: nextDate,
          },
          tags: {
            some: {
              tagId: tag.id,
            },
          },
        },
      });

      const existing = await prisma.trendData.findUnique({
        where: {
          tagId_date: {
            tagId: tag.id,
            date: currentDate,
          },
        },
      });

      if (existing) {
        await prisma.trendData.update({
          where: {
            tagId_date: {
              tagId: tag.id,
              date: currentDate,
            },
          },
          data: {
            count: papersWithTag,
          },
        });
        updated++;
      } else {
        await prisma.trendData.create({
          data: {
            tagId: tag.id,
            date: currentDate,
            count: papersWithTag,
          },
        });
        created++;
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return { processed, created, updated };
}

export function calculateAdoptionRate(
  currentCount: number,
  totalCount: number
): number {
  if (totalCount === 0) return 0;
  return (currentCount / totalCount) * 100;
}

export function formatTrendDirection(direction: TrendDirection): string {
  switch (direction) {
    case 'up':
      return '↗ Growing';
    case 'down':
      return '↘ Declining';
    case 'flat':
      return '→ Stable';
  }
}

export function getTrendColor(direction: TrendDirection): string {
  switch (direction) {
    case 'up':
      return 'text-green-500';
    case 'down':
      return 'text-red-500';
    case 'flat':
      return 'text-gray-500';
  }
}
