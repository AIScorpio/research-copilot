import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit, isRedisConfigured } from '@/lib/rate-limit';

// Rate limiting configuration - DISABLED due to missing Redis setup
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED === 'true';

// Paths exempt from rate limiting (OAuth callbacks must not be throttled)
const RATE_LIMIT_EXEMPT_PATHS = ['/api/auth/callback'];

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  '/',
  '/papers',
  '/archives',
  '/favorites',
  '/pipeline',
  '/radar',
  '/recommendations',
  '/export',
  '/chat',
  '/alerts',
  '/trends',
  '/competitive-intel',
  '/settings',
];

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/about',
  '/api/auth',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
  
  const isPublicRoute = PUBLIC_ROUTES.some(route =>
    pathname === route || pathname.startsWith(route)
  );

  // Check for auth cookie
  const authCookie = request.cookies.get('auth_user');
  const isAuthenticated = !!authCookie?.value;

  // Redirect to login if accessing protected route without auth
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to home if accessing login/register while already authenticated
  if ((pathname === '/login' || pathname === '/register') && isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Apply rate limiting only to API routes
  if (pathname.startsWith('/api')) {
    const isRateLimitExempt = RATE_LIMIT_EXEMPT_PATHS.some(p => pathname.startsWith(p));

    if (RATE_LIMIT_ENABLED && !isRateLimitExempt) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                    request.headers.get('x-real-ip') ||
                    'unknown';

      const result = await rateLimit(ip);

      if (!result.allowed) {
        const headers = new Headers();
        headers.set('Retry-After', Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)).toString());
        headers.set('X-RateLimit-Limit', result.limit.toString());
        headers.set('X-RateLimit-Remaining', result.remaining.toString());
        headers.set('X-RateLimit-Reset', new Date(result.reset).toISOString());

        return NextResponse.json(
          { error: 'Too many requests', retryAfter: new Date(result.reset).toISOString() },
          { status: 429, headers }
        );
      }

      if (isRedisConfigured) {
        const response = NextResponse.next();
        response.headers.set('X-RateLimit-Limit', result.limit.toString());
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
        response.headers.set('X-RateLimit-Reset', new Date(result.reset).toISOString());
        return response;
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/papers/:path*',
    '/archives/:path*',
    '/favorites/:path*',
    '/pipeline/:path*',
    '/radar/:path*',
    '/recommendations/:path*',
    '/export/:path*',
    '/chat/:path*',
    '/alerts/:path*',
    '/trends/:path*',
    '/competitive-intel/:path*',
    '/settings/:path*',
    '/login',
    '/register',
    '/api/:path*',
  ],
};
