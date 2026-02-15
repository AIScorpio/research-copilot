import { cookies } from 'next/headers';
import { requireAuth, createUnauthorizedResponse } from '@/lib/session';
import { CSRF_HEADER_NAME } from '@/lib/csrf';
import { NextResponse } from 'next/server';

/**
 * Validates CSRF token from request headers against cookie
 * Returns true if valid, false otherwise
 */
export async function validateCSRFRequest(request: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const csrfToken = request.headers.get(CSRF_HEADER_NAME);
  const cookieToken = cookieStore.get('csrf_token')?.value;
  
  return csrfToken === cookieToken;
}

/**
 * Returns CSRF error response
 */
export function createCSRFErrorResponse() {
  return NextResponse.json(
    { error: "Invalid CSRF token" }, 
    { status: 403 }
  );
}

/**
 * Validates both authentication and CSRF
 * Returns user object if valid, error response otherwise
 */
export async function validateAuthenticatedRequest(request: Request): Promise<{ success: true; user: any } | { success: false; response: NextResponse }> {
  // Validate authentication
  try {
    const user = await requireAuth();
    
    // Validate CSRF
    const isValidCSRF = await validateCSRFRequest(request);
    if (!isValidCSRF) {
      return { 
        success: false, 
        response: createCSRFErrorResponse() 
      };
    }
    
    return { success: true, user };
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { 
        success: false, 
        response: createUnauthorizedResponse() 
      };
    }
    throw error;
  }
}

/**
 * Wraps an API handler with authentication and CSRF validation
 * Automatically validates and returns error responses if validation fails
 */
export function withAuthAndCSRF(
  handler: (request: Request, user: any, ...args: any[]) => Promise<NextResponse>
) {
  return async (request: Request, ...args: any[]) => {
    const validation = await validateAuthenticatedRequest(request);
    
    if (!validation.success) {
      return validation.response;
    }
    
    return handler(request, validation.user, ...args);
  };
}

/**
 * Wraps an API handler with authentication only (no CSRF)
 * Useful for GET requests or APIs that don't require CSRF
 */
export function withAuth(
  handler: (request: Request, user: any, ...args: any[]) => Promise<NextResponse>
) {
  return async (request: Request, ...args: any[]) => {
    try {
      const user = await requireAuth();
      return handler(request, user, ...args);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        return createUnauthorizedResponse();
      }
      throw error;
    }
  };
}
