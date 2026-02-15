import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { handleError, createValidationError } from '@/lib/error-handler';
import { schemas } from '@/lib/validation/schemas';
import { validateRequest } from '@/lib/validation/helpers';

export async function POST(request: Request) {
    try {
        const validation = validateRequest(schemas.auth.register, await request.json());
        if (!validation.success) return validation.response;

        const { email, password } = validation.data;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            const error = createValidationError('User with this email already exists');
            const handled = handleError(error);
            return NextResponse.json(handled, { status: handled.statusCode });
        }

        const hashedPassword = hashPassword(password);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword
            }
        });

        return NextResponse.json({ success: true, userId: user.id });

    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
