import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '../logger';

export function validateRequest<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string; response: NextResponse } {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    }).join('; ');

    return {
      success: false,
      error: errors,
      response: NextResponse.json(
        {
          error: 'Invalid input data',
          details: result.error.issues,
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}

export function validateQueryParams<T extends z.ZodSchema>(
  schema: T,
  searchParams: URLSearchParams
): { success: true; data: z.infer<T> } | { success: false; error: string; response: NextResponse } {
  const params = Object.fromEntries(searchParams);
  return validateRequest(schema, params);
}

export function parseQueryIds(searchParams: URLSearchParams, key: string): string[] | undefined {
  const value = searchParams.get(key);
  if (!value) return undefined;
  return value.split(',').filter(Boolean);
}

export function logValidationError(error: string, context?: string) {
  logger.error(`Validation Error${context ? ` ${context}` : ''}: ${error}`);
}

export function handleValidationError(
  result: ReturnType<typeof validateRequest>,
  context?: string
): NextResponse | null {
  if (!result.success) {
    logValidationError(result.error, context);
    return result.response;
  }
  return null;
}
