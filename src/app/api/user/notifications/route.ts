import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { handleError, createUnauthorizedError, createValidationError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

async function getAuthUser() {
    try {
        const cookieStore = await cookies();
        let userId = cookieStore.get('auth_user')?.value;

        // If no session cookie, fallback to the primary user for local dev convenience
        if (!userId) {
            const firstUser = await prisma.user.findFirst();
            if (firstUser) {
                logger.debug(`[Auth] No session cookie found. Falling back to primary user: ${firstUser.email}`);
                return firstUser.id;
            }
        }
        return userId || null;
    } catch (error) {
        logger.error('[Auth] Error getting session:', { error: error instanceof Error ? error.message : String(error) });
        return null;
    }
}

export async function GET() {
    try {
        const userId = await getAuthUser();
        if (!userId) {
            const error = createUnauthorizedError('Authentication required');
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                emailAlerts: true,
                newsletterAlerts: true,
                subscribers: {
                    select: { email: true, id: true }
                }
            }
        });

        if (!user) {
            const error = createUnauthorizedError('User not found');
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        return NextResponse.json({
            emailAlerts: user.emailAlerts,
            newsletterAlerts: user.newsletterAlerts,
            subscribers: user.subscribers
        });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getAuthUser();
        if (!userId) {
            const error = createUnauthorizedError('Authentication required');
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        const body = await request.json();
        const { emailAlerts, newsletterAlerts, action, email } = body;

        logger.debug(`[API/Notifications] Action: ${action}`, { emailAlerts, newsletterAlerts, email });

        if (action === 'toggle') {
            const updateData: any = {};
            if (emailAlerts !== undefined) updateData.emailAlerts = !!emailAlerts;
            if (newsletterAlerts !== undefined) updateData.newsletterAlerts = !!newsletterAlerts;

            await prisma.user.update({
                where: { id: userId },
                data: updateData
            });
            logger.debug('[API/Notifications] User updated successfully');
        }
        else if (action === 'add' && email) {
            if (!email.includes('@')) {
                const error = createValidationError('Invalid email format', { email });
                const handled = handleError(error);
                return NextResponse.json(handled, { status: handled.statusCode });
            }

            await prisma.notificationSubscriber.upsert({
                where: {
                    userId_email: {
                        userId,
                        email: email.trim().toLowerCase()
                    }
                },
                update: {},
                create: {
                    userId,
                    email: email.trim().toLowerCase()
                }
            });
            logger.debug('[API/Notifications] Subscriber added/upserted');
        }
        else if (action === 'remove' && email) {
            await prisma.notificationSubscriber.deleteMany({
                where: { userId, email }
            });
            logger.debug('[API/Notifications] Subscriber removed');
        }

        // Fetch fresh state to return
        const updatedUser = await prisma.user.findUnique({
            where: { id: userId },
            include: { subscribers: true }
        });

        return NextResponse.json({
            success: true,
            settings: {
                emailAlerts: updatedUser?.emailAlerts,
                newsletterAlerts: updatedUser?.newsletterAlerts,
                subscribers: updatedUser?.subscribers || []
            }
        });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
