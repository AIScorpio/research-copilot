import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { readFileSync } from 'fs';
import { join } from 'path';

const corpusCache: Map<string, PaperContextInfo> = new Map();
let promptsConfigCache: Record<string, string> | null = null;

function loadPromptsConfig(): Record<string, string> {
    if (promptsConfigCache) return promptsConfigCache;
    try {
        const raw = readFileSync(join(process.cwd(), 'config', 'prompts.json'), 'utf-8');
        promptsConfigCache = JSON.parse(raw);
        return promptsConfigCache!;
    } catch (error) {
        logger.error('[RAG] Failed to load config/prompts.json', { error });
        promptsConfigCache = {};
        return promptsConfigCache;
    }
}

export function clearCorpusCache(): void {
    corpusCache.clear();
    promptsConfigCache = null;
}

export interface PaperContextInfo {
    markdown: string;
    paperCount: number;
    dateRange: string;
    paperIds: string[];
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
    const cached = corpusCache.get(mode);
    if (cached) {
        const currentCount = await prisma.paper.count({ where: { deletedAt: null } });
        if (currentCount === cached.paperCount) {
            logger.info(`[RAG] Using cached corpus (${mode} mode, ${cached.paperCount} papers)`);
            return cached;
        }
        logger.info(`[RAG] Corpus stale (${mode} mode, cached=${cached.paperCount}, current=${currentCount}), reloading`);
    }

    const papers = await prisma.paper.findMany({
        where: { deletedAt: null },
        include: { tags: { include: { tag: true } } },
        orderBy: { relevanceScore: 'desc' },
    });

    if (papers.length === 0) {
        return { markdown: '', paperCount: 0, dateRange: 'N/A', paperIds: [] };
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
    const result = { markdown, paperCount: papers.length, dateRange, paperIds: papers.map(p => p.id) };
    corpusCache.set(mode, result);
    logger.info(`[RAG] Loaded ${papers.length} papers in ${mode} mode`);

    return result;
}

export function buildSystemPrompt(corpusInfo: PaperContextInfo): string {
    const config = loadPromptsConfig();
    const focusAreas = 'risk-management, compliance, fraud-detection, credit-assessment, model-governance';

    if (corpusInfo.paperCount === 0) {
        const template = config.chatSystemPromptEmpty || `You are a research intelligence assistant for a banking/financial services AI research team.\nThe paper repository is currently empty. Inform the user and suggest running a collection.\nThe organization's research focus areas are: {{FOCUS_AREAS}}.`;
        return template.replace(/\{\{FOCUS_AREAS\}\}/g, focusAreas);
    }

    const template = config.chatSystemPrompt || `You are a research intelligence assistant for a banking/financial services AI research team.
You have access to a curated collection of {{PAPER_COUNT}} academic papers (collected {{DATE_RANGE}}).
Below is the COMPLETE paper repository — you can see every paper.

RULES:
1. Every factual claim must be traced to a specific paper
2. Cite papers inline as **[Title](url)** — relevance: X.X/10 — YYYY-MM-DD.
3. Start every answer with "Based on {{PAPER_COUNT}} papers in the repository"
4. Never fabricate paper titles, scores, or findings
5. If a query returns 0 results, say "No papers found"
6. Group papers by theme when returning 3+ papers
7. End every response with 2-3 suggested follow-up questions.

The organization's research focus areas are: {{FOCUS_AREAS}}.

PAPER CORPUS ({{PAPER_COUNT}} papers):
{{PAPER_CORPUS}}`;

    return template
        .replace(/\{\{PAPER_COUNT\}\}/g, String(corpusInfo.paperCount))
        .replace(/\{\{DATE_RANGE\}\}/g, corpusInfo.dateRange)
        .replace(/\{\{FOCUS_AREAS\}\}/g, focusAreas)
        .replace(/\{\{PAPER_CORPUS\}\}/g, corpusInfo.markdown);
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

export const MAX_SUPPLEMENTARY_PAPERS = 10;

export function detectPaperReferences(
    userMessage: string,
    assistantContext: string | undefined,
    totalPaperCount: number
): number[] {
    const pattern = /(?:\b(?:paper\s*(?:#?\s*\d+|at\s+position\s*\d+)|(?:the\s+)?(?:\d+)(?:st|nd|rd|th)?\s+paper)|第\s*\d+\s*篇)/gi;

    let textToSearch = userMessage;
    const matches = userMessage.match(pattern);

    if (!matches || matches.length === 0) {
        if (assistantContext) {
            const ctxMatches = assistantContext.match(pattern);
            if (ctxMatches && ctxMatches.length > 0) {
                textToSearch = assistantContext;
            } else {
                return [];
            }
        } else {
            return [];
        }
    }

    const numberPattern = /\d+/g;
    const allNumbers: number[] = [];
    let numMatch;
    const searchStr = matches ? userMessage : textToSearch;

    while ((numMatch = numberPattern.exec(searchStr)) !== null) {
        allNumbers.push(parseInt(numMatch[0], 10));
    }

    const unique = [...new Set(allNumbers)];
    const valid = unique.filter(n => n >= 1 && n <= totalPaperCount);
    return valid.slice(0, MAX_SUPPLEMENTARY_PAPERS);
}

export async function buildSupplementaryContext(
    paperIds: string[],
    indices: number[]
): Promise<string> {
    const targetIds = indices.map(i => paperIds[i - 1]).filter(Boolean);

    if (targetIds.length === 0) return '';

    const papers = await prisma.paper.findMany({
        where: { id: { in: targetIds }, deletedAt: null },
        include: { tags: { include: { tag: true } } },
    });

    const sections = papers.map((p) => {
        const tags = p.tags.map(pt => pt.tag.name).join(', ');
        const scores = `R:${p.relevanceScore?.toFixed(1) ?? '-'} T:${p.technicalScore?.toFixed(1) ?? '-'} B:${p.businessScore?.toFixed(1) ?? '-'} Ti:${p.timelinessScore?.toFixed(1) ?? '-'} P:${p.practicalityScore?.toFixed(1) ?? '-'}`;
        const pubDate = p.publicationDate ? p.publicationDate.toISOString().split('T')[0] : '';
        const collDate = p.collectedAt.toISOString().split('T')[0];
        const assessment = p.assessmentReason || '';

        let section = `## Paper ${paperIds.indexOf(p.id) + 1} | ${scores} | ${pubDate}\n`;
        section += `**Title:** ${p.title}\n`;
        section += `**Tags:** ${tags}\n`;
        section += `**Source:** ${p.source || 'unknown'} | **Collected:** ${collDate}\n`;
        section += `**URL:** ${p.url}\n`;
        if (assessment) {
            section += `**Why collected:** ${assessment}\n`;
        }
        if (p.abstract) {
            section += `**Abstract:** ${p.abstract}\n`;
        }
        return section;
    });

    return sections.join('---\n');
}
