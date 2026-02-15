import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/error-handler';

export async function GET() {
    try {
        const tags = await prisma.tag.findMany({
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(tags);
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
