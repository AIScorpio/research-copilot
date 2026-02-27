import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET() {
    const results: Record<string, any> = {};
    
    // Test ArXiv
    try {
        const arxivUrl = 'https://export.arxiv.org/api/query?search_query=AI&start=0&max_results=1';
        const arxivRes = await fetch(arxivUrl, { timeout: 10000 } as any);
        results.arxiv = {
            status: arxivRes.status,
            ok: arxivRes.ok,
            headers: Object.fromEntries(arxivRes.headers.entries())
        };
        if (arxivRes.ok) {
            const text = await arxivRes.text();
            results.arxiv.hasContent = text.length > 0;
            results.arxiv.preview = text.substring(0, 200);
        }
    } catch (error) {
        results.arxiv = { 
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        };
    }
    
    // Test Semantic Scholar
    try {
        const ssUrl = 'https://api.semanticscholar.org/graph/v1/paper/search?query=AI&fields=title&limit=1';
        const ssRes = await fetch(ssUrl, { timeout: 10000 } as any);
        results.semanticScholar = {
            status: ssRes.status,
            ok: ssRes.ok,
            headers: Object.fromEntries(ssRes.headers.entries())
        };
        if (ssRes.ok) {
            const json = await ssRes.json();
            results.semanticScholar.hasData = !!json.data;
            results.semanticScholar.total = json.total;
        }
    } catch (error) {
        results.semanticScholar = { 
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        };
    }
    
    // Test environment
    results.environment = {
        nodeEnv: process.env.NODE_ENV,
        vercel: process.env.VERCEL,
        region: process.env.VERCEL_REGION,
        hasGroqKey: !!process.env.GROQ_API_KEY,
    };
    
    logger.info('Network diagnostics', results);
    
    return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        results
    });
}
