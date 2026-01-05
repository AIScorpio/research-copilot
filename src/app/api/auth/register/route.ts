import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }

        const hashedPassword = hashPassword(password);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword
            }
        });

        // In a real app, we would set a session cookie here.
        // For now, return success and let frontend handle redirection to login or auto-login logic.
        return NextResponse.json({ success: true, userId: user.id });

    } catch (error) {
        return NextResponse.json({ error: "Registration failed" }, { status: 500 });
    }
}
