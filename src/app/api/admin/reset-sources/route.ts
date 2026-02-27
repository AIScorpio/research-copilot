import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function POST() {
    try {
        // Only allow authenticated admin users
        const user = await requireAuth();
        
        // Delete all existing sources
        await prisma.source.deleteMany({});
        
        // Create correct academic sources
        const sources = [
            { name: 'arxiv', url: 'https://export.arxiv.org/api/query', type: 'academic', enabled: true },
            { name: 'semantic-scholar', url: 'https://api.semanticscholar.org/graph/v1', type: 'academic', enabled: true },
            { name: 'ssrn', url: 'https://papers.ssrn.com', type: 'academic', enabled: true },
            { name: 'ieee', url: 'https://api.semanticscholar.org/graph/v1', type: 'academic', enabled: true },
            { name: 'acm', url: 'https://api.semanticscholar.org/graph/v1', type: 'academic', enabled: true },
        ];
        
        for (const source of sources) {
            await prisma.source.create({ data: source });
        }
        
        return NextResponse.json({
            success: true,
            message: 'Sources reset to academic collection sources',
            count: sources.length
        });
        
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

export async function GET() {
    try {
        await requireAuth();
        const sources = await prisma.source.findMany();
        
        return NextResponse.json({
            success: true,
            sources: sources.map(s => ({
                name: s.name,
                url: s.url,
                type: s.type,
                enabled: s.enabled
            }))
        });
        
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
