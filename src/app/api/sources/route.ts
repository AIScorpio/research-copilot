import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        const count = await prisma.source.count();
        if (count === 0) {
            const DEFAULTS = [
                { name: "ArXiv", url: "https://arxiv.org" },
                { name: "Google Scholar", url: "https://scholar.google.com" },
                { name: "IEEE Xplore", url: "https://ieeexplore.ieee.org" },
                { name: "SSRN", url: "https://www.ssrn.com" },
                { name: "ACM Digital Library", url: "https://dl.acm.org" }
            ];

            for (const d of DEFAULTS) {
                await prisma.source.create({ data: { ...d, enabled: true } });
            }
        }

        // Deduplication Logic
        const allSources = await prisma.source.findMany({ orderBy: { createdAt: 'asc' } });
        const uniqueNames = new Set();
        const duplicates = [];

        for (const s of allSources) {
            if (uniqueNames.has(s.name)) {
                duplicates.push(s.id);
            } else {
                uniqueNames.add(s.name);
            }
        }

        if (duplicates.length > 0) {
            await prisma.source.deleteMany({
                where: { id: { in: duplicates } }
            });
        }

        const sources = await prisma.source.findMany({ orderBy: { createdAt: 'desc' } });
        return NextResponse.json(sources);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { name, url } = await request.json();
        if (!name || !url) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

        const existing = await prisma.source.findFirst({
            where: {
                OR: [
                    { name: name },
                    { url: url }
                ]
            }
        });

        if (existing) {
            return NextResponse.json({ error: "Source already exists" }, { status: 409 });
        }

        const source = await prisma.source.create({
            data: { name, url, enabled: true }
        });
        return NextResponse.json(source);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to create source' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        await prisma.source.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 });
    }
}
