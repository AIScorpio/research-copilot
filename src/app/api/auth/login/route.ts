import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { cookies } from 'next/headers';
import { handleError, createUnauthorizedError } from '@/lib/error-handler';
import { generateCSRFToken, setCSRFCookie } from '@/lib/csrf';
import { schemas } from '@/lib/validation/schemas';
import { validateRequest } from '@/lib/validation/helpers';

export async function POST(request: Request) {
    try {
        const validation = validateRequest(schemas.auth.login, await request.json());
        if (!validation.success) return validation.response;

        const { email, password } = validation.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            const error = createUnauthorizedError('Invalid email or password');
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        const isValid = verifyPassword(password, user.password);
        if (!isValid) {
            const error = createUnauthorizedError('Invalid email or password');
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        const cookieStore = await cookies();

        const csrfToken = await generateCSRFToken();
        setCSRFCookie(cookieStore, csrfToken);

        cookieStore.set('auth_user', user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24 * 7
        });

        return NextResponse.json({
            success: true,
            user: { id: user.id, email: user.email },
            csrfToken
        });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
