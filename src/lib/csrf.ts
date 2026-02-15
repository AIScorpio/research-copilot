import { randomBytes } from 'crypto';

export const CSRF_TOKEN_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export async function generateCSRFToken(): Promise<string> {
  return randomBytes(32).toString('hex');
}

export async function validateCSRFToken(request: Request, cookies: any): Promise<boolean> {
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  const cookieToken = cookies.get(CSRF_TOKEN_COOKIE_NAME)?.value;

  if (!headerToken || !cookieToken) {
    return false;
  }

  return headerToken === cookieToken;
}

export function setCSRFCookie(cookies: any, token: string): void {
  cookies.set(CSRF_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/'
  });
}

export function getCSRFTokenFromCookies(cookies: any): string | undefined {
  return   cookies.get(CSRF_TOKEN_COOKIE_NAME)?.value;
}
