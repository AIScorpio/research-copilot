import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED === 'true';
const RATE_LIMIT_EXEMPT_PATHS = ['/api/auth/callback'];

const PROTECTED_ROUTES = [
  '/', '/papers', '/archives', '/favorites', '/pipeline',
  '/radar', '/recommendations', '/export', '/chat',
  '/alerts', '/trends', '/competitive-intel', '/settings',
];

const PUBLIC_ROUTES = ['/login', '/register', '/about', '/api/auth'];

async function checkRateLimit(ip: string): Promise<{
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  redisActive: boolean;
}> {
  try {
    const mod = await import('@/lib/rate-limit');
    const result = await mod.rateLimit(ip);
    return { ...result, redisActive: mod.isRedisConfigured };
  } catch {
    return { allowed: true, limit: 100, remaining: 100, reset: Date.now() + 60000, redisActive: false };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedRoute = PROTECTED_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
  
  const isPublicRoute = PUBLIC_ROUTES.some(route =>
    pathname === route || pathname.startsWith(route)
  );

  const authCookie = request.cookies.get('auth_user');
  const isAuthenticated = !!authCookie?.value;

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if ((pathname === '/login' || pathname === '/register') && isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (pathname.startsWith('/api')) {
    const isRateLimitExempt = RATE_LIMIT_EXEMPT_PATHS.some(p => pathname.startsWith(p));

    if (RATE_LIMIT_ENABLED && !isRateLimitExempt) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                    request.headers.get('x-real-ip') ||
                    'unknown';

      const result = await checkRateLimit(ip);

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

      if (result.redisActive) {
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
    '/', '/papers/:path*', '/archives/:path*', '/favorites/:path*',
    '/pipeline/:path*', '/radar/:path*', '/recommendations/:path*',
    '/export/:path*', '/chat/:path*', '/alerts/:path*',
    '/trends/:path*', '/competitive-intel/:path*', '/settings/:path*',
    '/login', '/register', '/api/:path*',
  ],
};
