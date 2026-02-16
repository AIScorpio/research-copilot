import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/error-handler';
import { requireAuth, createUnauthorizedResponse } from '@/lib/session';
import { CSRF_HEADER_NAME } from '@/lib/csrf';
import { cookies } from 'next/headers';
import { schemas } from '@/lib/validation/schemas';
import { validateRequest } from '@/lib/validation/helpers';

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
        const handled = handleError(e);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}

export async function POST(request: Request) {
    try {
        await requireAuth();

        const cookieStore = await cookies();
        const isValidCSRF = request.headers.get(CSRF_HEADER_NAME) === cookieStore.get('csrf_token')?.value;
        if (!isValidCSRF) {
            return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
        }

        const validation = validateRequest(schemas.sources.create, await request.json());
        if (!validation.success) return validation.response;

        const { name, url } = validation.data;

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
        if (e instanceof Error && e.message === 'Unauthorized') {
            return createUnauthorizedResponse();
        }
        const handled = handleError(e);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}

export async function DELETE(request: Request) {
    try {
        await requireAuth();

        const cookieStore = await cookies();
        const isValidCSRF = request.headers.get(CSRF_HEADER_NAME) === cookieStore.get('csrf_token')?.value;
        if (!isValidCSRF) {
            return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
        }

        const validation = validateRequest(schemas.sources.delete, await request.json());
        if (!validation.success) return validation.response;

        const { id } = validation.data;

        await prisma.source.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e) {
        if (e instanceof Error && e.message === 'Unauthorized') {
            return createUnauthorizedResponse();
        }
        const handled = handleError(e);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}

export async function PATCH(request: Request) {
    try {
        await requireAuth();

        const cookieStore = await cookies();
        const isValidCSRF = request.headers.get(CSRF_HEADER_NAME) === cookieStore.get('csrf_token')?.value;
        if (!isValidCSRF) {
            return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
        }

        const body = await request.json();
        
        // Update by ID (for editing displayName and url)
        if (body.id) {
            const { id, displayName, url, enabled } = body;
            
            const updateData: Record<string, unknown> = {};
            if (displayName !== undefined) updateData.displayName = displayName;
            if (url !== undefined) updateData.url = url;
            if (enabled !== undefined) updateData.enabled = enabled;
            
            const source = await prisma.source.update({
                where: { id },
                data: updateData
            });
            return NextResponse.json(source);
        }
        
        // Update by name (for toggling enabled)
        if (body.name) {
            const { name, enabled } = body;
            
            const source = await prisma.source.update({
                where: { name },
                data: { enabled }
            });
            return NextResponse.json(source);
        }
        
        return NextResponse.json({ error: "Missing id or name" }, { status: 400 });
    } catch (e) {
        if (e instanceof Error && e.message === 'Unauthorized') {
            return createUnauthorizedResponse();
        }
        const handled = handleError(e);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
