import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Mock user ID for now, pending auth implementation
const MOCK_USER_ID = "user-1";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const resolvedParams = await params;
    const paperId = resolvedParams.id;

    if (!paperId) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    try {
        // Check if favorited
        const existing = await prisma.userFavorite.findUnique({
            where: {
                userId_paperId: {
                    userId: MOCK_USER_ID,
                    paperId: paperId
                }
            }
        });

        if (existing) {
            // Unfavorite
            await prisma.userFavorite.delete({
                where: {
                    userId_paperId: {
                        userId: MOCK_USER_ID,
                        paperId: paperId
                    }
                }
            });
            return NextResponse.json({ favorited: false });
        } else {
            // First ensure user exists (mock)
            const user = await prisma.user.upsert({
                where: { email: "demo@example.com" }, // mock helper
                update: {},
                create: {
                    id: MOCK_USER_ID,
                    email: "demo@example.com",
                    password: "mock-hash-pass"
                }
            });

            // Favorite
            await prisma.userFavorite.create({
                data: {
                    userId: user.id,
                    paperId: paperId
                }
            });
            return NextResponse.json({ favorited: true });
        }
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to toggle favorite' }, { status: 500 });
    }
}
