import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError, createValidationError } from '@/lib/error-handler';
import { requireAuth, createUnauthorizedResponse } from '@/lib/session';
import { CSRF_HEADER_NAME } from '@/lib/csrf';
import { cookies } from 'next/headers';
import { schemas } from '@/lib/validation/schemas';
import { validateQueryParams, validateRequest } from '@/lib/validation/helpers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const validation = validateQueryParams(schemas.alerts.query, searchParams);
    if (!validation.success) return validation.response;

    const { status, priority, source, limit, offset } = validation.data;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (source) {
      where.sourceName = source;
    }

    const alerts = await prisma.regulatoryAlert.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit,
      skip: offset,
    });

    const totalCount = await prisma.regulatoryAlert.count({ where });

    const alertsWithKeywords = alerts.map(alert => {
      const keywords = (() => {
        try {
          return JSON.parse(alert.keywords);
        } catch {
          return [];
        }
      })();
      return {
        ...alert,
        keywords
      };
    });

    return NextResponse.json({
      alerts: alertsWithKeywords,
      total: totalCount,
      limit,
      offset
    });
  } catch (error) {
    const handled = handleError(error);
    return NextResponse.json(handled, { status: handled.statusCode });
  }
}

  export async function PUT(request: Request) {
  try {
    await requireAuth();

    const cookieStore = await cookies();
    const isValidCSRF = request.headers.get(CSRF_HEADER_NAME) === cookieStore.get('csrf_token')?.value;
    if (!isValidCSRF) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    const body = await request.json();
    const validation = validateRequest(schemas.alerts.update, body);
    if (!validation.success) return validation.response;

    const { id, ...updateData } = validation.data;

    const alert = await prisma.regulatoryAlert.update({
      where: { id },
      data: updateData
    });

    const keywords = (() => {
      try {
        return JSON.parse(alert.keywords);
      } catch {
        return [];
      }
    })();

    const alertWithKeywords = {
      ...alert,
      keywords
    };

    return NextResponse.json(alertWithKeywords);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createUnauthorizedResponse();
    }
    const handled = handleError(error);
    return NextResponse.json(handled, { status: handled.statusCode });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();

    const cookieStore = await cookies();
    const isValidCSRF = request.headers.get(CSRF_HEADER_NAME) === cookieStore.get('csrf_token')?.value;
    if (!isValidCSRF) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    const body = await request.json();
    const { test, ...alertData } = body;

    if (test) {
      const testAlert = await prisma.regulatoryAlert.create({
        data: {
          sourceId: "test-source",
          sourceName: "Test Source",
          title: "AI in Credit Decisions: New Regulatory Guidance",
          content: "Federal Reserve releases new guidance on use of artificial intelligence in credit decision processes, emphasizing model governance and fairness.",
          url: "https://example.com/test-alert",
          keywords: JSON.stringify(["artificial intelligence", "credit decisions", "model governance", "fairness"]),
          relevance: 95,
          priority: "HIGH",
          status: "new"
        }
      });

      const keywords = (() => {
        try {
          return JSON.parse(testAlert.keywords);
        } catch {
          return [];
        }
      })();

      const alertWithKeywords = {
        ...testAlert,
        keywords
      };

      return NextResponse.json({ success: true, alert: alertWithKeywords }, { status: 201 });
    }

    const validation = validateRequest(schemas.alerts.create, alertData);
    if (!validation.success) return validation.response;

    const validated = validation.data;

    const existing = await prisma.regulatoryAlert.findFirst({
      where: { url: validated.url }
    });

    if (existing) {
      const error = createValidationError('Alert with this URL already exists', { url: validated.url });
      const handled = handleError(error);
      return NextResponse.json(handled, { status: handled.statusCode });
    }

    const alert = await prisma.regulatoryAlert.create({
      data: {
        ...validated,
        keywords: JSON.stringify(validated.keywords)
      }
    });

    const keywords = (() => {
      try {
        return JSON.parse(alert.keywords);
      } catch {
        return [];
      }
    })();

    const alertWithKeywords = {
      ...alert,
      keywords
    };

    return NextResponse.json({ success: true, alert: alertWithKeywords }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createUnauthorizedResponse();
    }
    const handled = handleError(error);
    return NextResponse.json(handled, { status: handled.statusCode });
  }
}
