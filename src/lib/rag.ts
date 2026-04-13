import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface PaperContextInfo {
    markdown: string;
    paperCount: number;
    dateRange: string;
}

export interface SourcePaper {
    id: string;
    title: string;
    url: string;
    relevanceScore: number | null;
    publicationDate: string | null;
    tags: string[];
}

export async function loadPaperCorpus(mode: 'full' | 'compact'): Promise<PaperContextInfo> {
    const papers = await prisma.paper.findMany({
        where: { deletedAt: null },
        include: { tags: { include: { tag: true } } },
        orderBy: { relevanceScore: 'desc' },
    });

    if (papers.length === 0) {
        return { markdown: '', paperCount: 0, dateRange: 'N/A' };
    }

    const dates = papers.map(p => p.publicationDate || p.collectedAt).filter(Boolean) as Date[];
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const dateRange = `${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`;

    const sections = papers.map((p, i) => {
        const tags = p.tags.map(pt => pt.tag.name).join(', ');
        const scores = `R:${p.relevanceScore?.toFixed(1) ?? '-'} T:${p.technicalScore?.toFixed(1) ?? '-'} B:${p.businessScore?.toFixed(1) ?? '-'} Ti:${p.timelinessScore?.toFixed(1) ?? '-'} P:${p.practicalityScore?.toFixed(1) ?? '-'}`;
        const pubDate = p.publicationDate ? p.publicationDate.toISOString().split('T')[0] : '';
        const collDate = p.collectedAt.toISOString().split('T')[0];
        const assessment = p.assessmentReason || '';

        let section = `## Paper ${i + 1} | ${scores} | ${pubDate}\n`;
        section += `**Title:** ${p.title}\n`;
        section += `**Tags:** ${tags}\n`;
        section += `**Source:** ${p.source || 'unknown'} | **Collected:** ${collDate}\n`;
        section += `**URL:** ${p.url}\n`;
        if (assessment) {
            section += `**Why collected:** ${assessment}\n`;
        }
        if (mode === 'full' && p.abstract) {
            section += `**Abstract:** ${p.abstract}\n`;
        }
        return section;
    });

    const markdown = sections.join('---\n');
    logger.info(`[RAG] Loaded ${papers.length} papers in ${mode} mode`);

    return { markdown, paperCount: papers.length, dateRange };
}

export function buildSystemPrompt(corpusInfo: PaperContextInfo): string {
    const focusAreas = 'risk-management, compliance, fraud-detection, credit-assessment, model-governance';

    if (corpusInfo.paperCount === 0) {
        return `You are a research intelligence assistant for a banking/financial services AI research team.
The paper repository is currently empty. Inform the user and suggest running a collection.
The organization's research focus areas are: ${focusAreas}.`;
    }

    return `You are a research intelligence assistant for a banking/financial services AI research team.
You have access to a curated collection of ${corpusInfo.paperCount} academic papers (collected ${corpusInfo.dateRange}).
Below is the COMPLETE paper repository — you can see every paper.

CAPABILITIES:
- Answer questions about ANY paper in the collection
- Cross-reference and compare multiple papers
- Synthesize trends across the corpus
- Identify gaps and contradictions
- Recommend papers based on specific criteria

RULES:
1. Every factual claim must be traced to a specific paper
2. Always cite papers as: **[Title](url)** — relevance: X.X/10 — YYYY-MM-DD
3. Start every answer with "Based on ${corpusInfo.paperCount} papers in the repository"
4. If abstracts lack specific details, say so — do not infer
5. Never fabricate paper titles, scores, or findings
6. If a query returns 0 results, say "No papers found" and suggest what to collect
7. Keep responses under 800 tokens unless the user asks for detail
8. Group papers by theme when returning 3+ papers
9. For executive/leadership context: use plain language, avoid unexplained jargon
10. End every response with 2-3 suggested follow-up questions. Format:
---
**Suggested questions:**
1. [question]
2. [question]
3. [question]

The organization's research focus areas are: ${focusAreas}.

PAPER CORPUS (${corpusInfo.paperCount} papers):
${corpusInfo.markdown}`;
}

export async function extractSources(responseContent: string): Promise<SourcePaper[]> {
    const urlPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    const matches: Array<{ title: string; url: string }> = [];
    let match;

    while ((match = urlPattern.exec(responseContent)) !== null) {
        matches.push({ title: match[1], url: match[2] });
    }

    if (matches.length === 0) return [];

    const urls = [...new Set(matches.map(m => m.url))];
    const papers = await prisma.paper.findMany({
        where: { url: { in: urls }, deletedAt: null },
        include: { tags: { include: { tag: true } } },
    });

    const urlToPaper = new Map(papers.map(p => [p.url, p]));

    return matches
        .filter(m => urlToPaper.has(m.url))
        .map(m => {
            const p = urlToPaper.get(m.url)!;
            return {
                id: p.id,
                title: p.title,
                url: p.url,
                relevanceScore: p.relevanceScore,
                publicationDate: p.publicationDate?.toISOString().split('T')[0] || null,
                tags: p.tags.map(pt => pt.tag.name),
            };
        });
}

export function getContextMode(contextWindow: number): 'full' | 'compact' {
    return contextWindow >= 256000 ? 'full' : 'compact';
}
