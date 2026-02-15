import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from './logger';

export interface AuthUser {
  id: string;
  email: string;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('auth_user')?.value;

    if (!sessionToken) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionToken },
      select: {
        id: true,
        email: true
      }
    });

    if (!user) {
      return null;
    }

    return user;
  } catch (error) {
    logger.error('Auth Error getting authenticated user', { error });
    return null;
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

export function createUnauthorizedResponse() {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  );
}
