import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { handleError } from '@/lib/error-handler';
import { requireAuth, createUnauthorizedResponse } from '@/lib/session';
import { CSRF_HEADER_NAME } from '@/lib/csrf';
import { cookies } from 'next/headers';

const alertUpdateSchema = z.object({
  status: z.enum(['new', 'read', 'dismissed']).optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify authentication
    await requireAuth();

    // Validate CSRF
    const cookieStore = await cookies();
    const isValidCSRF = request.headers.get(CSRF_HEADER_NAME) === cookieStore.get('csrf_token')?.value;
    if (!isValidCSRF) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = alertUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: "Invalid input", 
        details: validationResult.error.issues 
      }, { status: 400 });
    }

    const alert = await prisma.regulatoryAlert.update({
      where: { id },
      data: validationResult.data
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify authentication
    await requireAuth();

    // Validate CSRF
    const cookieStore = await cookies();
    const isValidCSRF = request.headers.get(CSRF_HEADER_NAME) === cookieStore.get('csrf_token')?.value;
    if (!isValidCSRF) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    await prisma.regulatoryAlert.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createUnauthorizedResponse();
    }
    const handled = handleError(error);
    return NextResponse.json(handled, { status: handled.statusCode });
  }
}
