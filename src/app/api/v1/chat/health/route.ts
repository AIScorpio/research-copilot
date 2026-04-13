import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        const paperCount = await prisma.paper.count({
            where: { deletedAt: null },
        });

        return NextResponse.json({
            status: 'ok',
            paperCount,
        });
    } catch (error) {
        return NextResponse.json(
            { status: 'error', message: 'Database query failed' },
            { status: 500 }
        );
    }
}
