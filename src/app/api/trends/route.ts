import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getMultipleTrends,
  identifyTrendingTopics,
  getAllTrends,
  type PeriodType,
} from '@/lib/trends';
import { handleError, createValidationError } from '@/lib/error-handler';

const trendsQuerySchema = z.object({
  tagIds: z.string().optional(),
  period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
  days: z.coerce.number().min(1).max(365).optional(),
  direction: z.enum(['up', 'down', 'flat']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = trendsQuerySchema.parse(Object.fromEntries(searchParams));

    const period = query.period as PeriodType;
    const tagIds = query.tagIds ? query.tagIds.split(',') : undefined;

    if (tagIds && tagIds.length > 0) {
      const trends = await getMultipleTrends(tagIds, period);

      const results = Array.from(trends.entries()).map(([tagId, metrics]) => ({
        tagId,
        ...metrics,
        trendData: metrics.trendData.map((d) => ({
          date: d.date.toISOString(),
          count: d.count,
        })),
      }));

      return NextResponse.json({ results });
    }

    const allTrends = await getAllTrends(period, query.direction);
    const limitedTrends = allTrends.slice(0, query.limit);

    const results = limitedTrends.map((trend) => ({
      ...trend,
      trendData: trend.trendData.map((d) => ({
        date: d.date.toISOString(),
        count: d.count,
      })),
    }));

    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = createValidationError('Invalid query parameters', { details: error.issues });
      const handled = handleError(validationError);
      return NextResponse.json(handled, { status: handled.statusCode });
    }

    const handled = handleError(error);
    return NextResponse.json(handled, { status: handled.statusCode });
  }
}

const trendingSchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
  limit: z.coerce.number().min(1).max(100).default(10),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { period, limit } = trendingSchema.parse(body);

    const trendingTopics = await identifyTrendingTopics(period, limit);

    const results = trendingTopics.map((trend) => ({
      ...trend,
      trendData: trend.trendData.map((d) => ({
        date: d.date.toISOString(),
        count: d.count,
      })),
    }));

    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = createValidationError('Invalid request body', { details: error.issues });
      const handled = handleError(validationError);
      return NextResponse.json(handled, { status: handled.statusCode });
    }

    const handled = handleError(error);
    return NextResponse.json(handled, { status: handled.statusCode });
  }
}
