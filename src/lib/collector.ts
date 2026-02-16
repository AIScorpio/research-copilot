import { XMLParser } from "fast-xml-parser";
import { prisma } from "./db";
import { getSocialTrends } from "./social-collector";
import { logger } from "./logger";

export interface SearchResult {
    title: string;
    abstract: string;
    url: string;
    source: string;
    publicationDate: Date;
}

const parser = new XMLParser({ ignoreAttributes: false });

// Track source failures for auto-disable
const sourceFailures = new Map<string, number>();
const MAX_FAILURES = 3; // Disable after 3 consecutive failures

async function markSourceFailure(sourceName: string) {
    const failures = (sourceFailures.get(sourceName) || 0) + 1;
    sourceFailures.set(sourceName, failures);

    logger.warn(`${sourceName} Failure ${failures}/${MAX_FAILURES}`);

    if (failures >= MAX_FAILURES) {
        logger.error(`${sourceName} Disabling source after ${failures} consecutive failures`);
        await prisma.source.updateMany({
            where: { name: sourceName },
            data: { enabled: false }
        });
        sourceFailures.delete(sourceName);
    }
}

async function resetSourceFailure(sourceName: string) {
    sourceFailures.delete(sourceName);
    // Re-enable if it was disabled
    await prisma.source.updateMany({
        where: { name: sourceName, enabled: false },
        data: { enabled: true }
    });
}

interface ArxivEntry {
    title: string;
    summary: string;
    id: string;
    published: string;
}

interface SemanticScholarPaper {
    title: string;
    abstract?: string;
    url?: string;
    openAccessPdf?: { url: string };
    paperId: string;
    venue?: string;
    publicationDate?: string;
}

async function searchArxiv(query: string, limit: number = 5, baseUrl: string = 'https://export.arxiv.org/api/query', retries: number = 3): Promise<SearchResult[]> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            // SIMPLIFIED: Use query as-is (already optimized by query-optimizer)
            // No ArXiv-specific syntax (no 'cat:', no 'all:')
            const searchQuery = query;
            
            const encodedQuery = encodeURIComponent(searchQuery);
            const url = `${baseUrl}?search_query=${encodedQuery}&start=0&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`;
            
            logger.debug(`ArXiv search URL: ${url.substring(0, 200)}...`);
            
            const res = await fetch(url);
            
            if (res.status === 429) {
                // Rate limited - wait and retry with exponential backoff
                const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                logger.warn(`ArXiv rate limited (429), retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            if (!res.ok) {
                logger.warn(`ArXiv API returned ${res.status}`);
                await markSourceFailure("ArXiv");
                return [];
            }

            const xml = await res.text();
            const data = parser.parse(xml);

            const entries = data.feed?.entry || [];
            const list = Array.isArray(entries) ? entries : [entries];

            await resetSourceFailure("ArXiv");

            return list.map((entry: ArxivEntry) => ({
                title: typeof entry.title === 'string' ? entry.title.replace(/\n/g, ' ').trim() : "No Title",
                abstract: typeof entry.summary === 'string' ? entry.summary.replace(/\n/g, ' ').trim() : "",
                url: entry.id,
                source: "ArXiv",
                publicationDate: new Date(entry.published),
            })).filter((p: SearchResult) => p.title !== "No Title");
        } catch (error) {
            if (attempt === retries - 1) {
                await markSourceFailure("ArXiv");
                logger.error("ArXiv Search Failed after retries", { error });
                return [];
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    return [];
}

async function searchSemanticScholar(query: string, limit: number = 5, baseUrl: string = 'https://api.semanticscholar.org/graph/v1'): Promise<SearchResult[]> {
    try {
        // Semantic Scholar Graph API
        const encodedQuery = encodeURIComponent(query);
        const res = await fetch(`${baseUrl}/paper/search?query=${encodedQuery}&limit=${limit}&fields=title,abstract,url,venue,publicationDate`);
        
        if (!res.ok) {
            await markSourceFailure("Semantic Scholar");
            return [];
        }

        const data = await res.json();

        if (!data.data) {
            await markSourceFailure("Semantic Scholar");
            return [];
        }

        await resetSourceFailure("Semantic Scholar");

        return data.data.map((paper: SemanticScholarPaper) => ({
            title: paper.title,
            abstract: paper.abstract || "No abstract available.",
            url: paper.url || paper.openAccessPdf?.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
            source: paper.venue || "Semantic Scholar",
            publicationDate: paper.publicationDate ? new Date(paper.publicationDate) : new Date('2000-01-01'),
        }));
    } catch (error) {
        await markSourceFailure("Semantic Scholar");
        logger.error("Semantic Scholar Search Failed", { error });
        return [];
    }
}

async function searchSSRN(query: string, limit: number = 5, baseUrl: string = 'https://papers.ssrn.com'): Promise<SearchResult[]> {
    try {
        // SSRN doesn't have a free public API, but we can scrape their RSS feed or search page
        // For now, implementing a basic RSS feed search

        // SSRN search URL returns HTML, but we can parse their recent papers feed
        // Alternative: Use their advanced search which returns results in a parseable format
        const res = await fetch(`${baseUrl}/sol3/JELJOUR_Results.cfm?form_name=journalBrowse&journal_id=&Network=no&lim=false&npage=1&nper_page=${limit}`);

        if (!res.ok) {
            logger.warn(`SSRN Search returned ${res.status}`);
            return [];
        }

        // Note: SSRN doesn't provide a clean API, so results would need HTML parsing
        // For now, returning empty array - would need cheerio or similar for scraping
        logger.warn('SSRN API integration requires HTML parsing - not yet implemented');
        return [];

    } catch (error) {
        logger.error("SSRN Search Failed", { error });
        return [];
    }
}

async function searchBankingSources(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
        // Banking News Sources RSS Feeds (updated to working URLs)
        const rssUrls = [
            'https://www.americanbanker.com/rss', // American Banker - Directly banking related
            'https://www.cnbc.com/id/10000664/device/rss/rss.html', // CNBC Banking - Banking specific
            'https://www.banklesstimes.com/feed/', // Bankless Times - Fintech/banking
            'https://www.pymnts.com/feed', // Pymnts.com - Payments/banking news
        ];

        const allResults: SearchResult[] = [];

        // Query in lowercase for case-insensitive matching
        const queryLower = query.toLowerCase();
        const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

        for (const rssUrl of rssUrls) {
            try {
                const sourceName = getSourceNameFromUrl(rssUrl);
                const res = await fetch(rssUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InsightFlow/1.0)' },
                    signal: AbortSignal.timeout(10000) // 10 second timeout
                });

                if (!res.ok) {
                    logger.warn(`${sourceName} RSS feed returned ${res.status}`);
                    continue;
                }

                const xml = await res.text();
                const rssData = parser.parse(xml);
                const items = rssData.rss?.channel?.item || rssData.channel?.item || [];

                const entries = Array.isArray(items) ? items : [items];

                for (const item of entries) {
                    const title = item.title || '';
                    const description = item.description || '';

                    // Check if item matches query terms
                    const matchesQuery = queryTerms.length === 0 ||
                        queryTerms.some(term =>
                            title.toLowerCase().includes(term) ||
                            description.toLowerCase().includes(term)
                        );

                    if (matchesQuery && title) {
                        const pubDate = parseRSSDate(item.pubDate || item.published);
                        const link = item.link || item.guid || '';

                        allResults.push({
                            title: title.replace(/\n/g, ' ').trim(),
                            abstract: stripHtml(description).substring(0, 500).trim() || 'No description available.',
                            url: link,
                            source: sourceName,
                            publicationDate: pubDate
                        });
                    }
                }
            } catch (sourceError) {
                const sourceName = getSourceNameFromUrl(rssUrl);
                logger.error(`${sourceName} Feed fetch failed`, { error: sourceError });
                continue;
            }
        }

        // Sort by date and limit results
        return allResults
            .sort((a, b) => b.publicationDate.getTime() - a.publicationDate.getTime())
            .slice(0, limit);

    } catch (error) {
        logger.error("Banking Sources Search Failed", { error });
        return [];
    }
}

function getSourceNameFromUrl(url: string): string {
    if (url.includes('americanbanker')) return 'American Banker';
    if (url.includes('cnbc.com') && url.includes('10000664')) return 'CNBC Banking';
    if (url.includes('banklesstimes')) return 'Bankless Times';
    if (url.includes('pymnts.com')) return 'Pymnts.com';
    if (url.includes('finextra')) return 'Finextra';
    if (url.includes('bankingdive')) return 'Banking Dive';
    if (url.includes('ft.com')) return 'Financial Times';
    if (url.includes('bis.org')) return 'BIS';
    if (url.includes('ecb.europa.eu')) return 'ECB';
    if (url.includes('fca.org.uk')) return 'FCA';
    if (url.includes('bankofengland.co.uk')) return 'PRA';
    if (url.includes('federalreserve.gov')) return 'Federal Reserve';
    if (url.includes('reddit.com')) return 'Reddit';
    if (url.includes('linkedin.com')) return 'LinkedIn';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter/X';
    return 'Banking News';
}

async function searchSocialSources(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
        // Extract keywords from query for social media filtering
        const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 3);

        logger.debug(`Social Media Collecting trends for keywords: ${keywords.join(', ')}`);

        const results = await getSocialTrends(keywords, limit);

        logger.debug(`Social Media Found ${results.length} posts`);

        return results;
    } catch (error) {
        logger.error("Social Media Collection failed", { error });
        return [];
    }
}

function parseRSSDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    
    // Try parsing with Date constructor
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;
    
    // Fallback to current date
    return new Date();
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function searchRegulatorySources(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
        // Regulatory Sources RSS Feeds (updated to working URLs)
        const rssUrls = [
            'https://www.bis.org/pressreleases.xml', // BIS Press Releases
            'https://www.bis.org/publications.xml', // BIS Publications
            'https://www.ecb.europa.eu/rss/pr.html', // ECB Press Releases
            'https://www.fca.org.uk/news/rss', // FCA News
            'https://www.federalreserve.gov/feeds/press_all.xml', // Federal Reserve Press Releases
            // Note: PRA RSS may have access restrictions
        ];

        const allResults: SearchResult[] = [];

        // Query in lowercase for case-insensitive matching
        const queryLower = query.toLowerCase();
        const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

        for (const rssUrl of rssUrls) {
            try {
                const sourceName = getSourceNameFromUrl(rssUrl);
                const res = await fetch(rssUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InsightFlow/1.0)' },
                    signal: AbortSignal.timeout(10000) // 10 second timeout
                });

                if (!res.ok) {
                    logger.warn(`${sourceName} RSS feed returned ${res.status}`);
                    continue;
                }

                const xml = await res.text();
                const rssData = parser.parse(xml);
                const items = rssData.rss?.channel?.item || rssData.channel?.item || [];

                const entries = Array.isArray(items) ? items : [items];

                for (const item of entries) {
                    const title = item.title || '';
                    const description = item.description || '';

                    // Check if item matches query terms (AI, model, risk, compliance, etc.)
                    const matchesQuery = queryTerms.length === 0 ||
                        queryTerms.some(term =>
                            title.toLowerCase().includes(term) ||
                            description.toLowerCase().includes(term)
                        );

                    if (matchesQuery && title) {
                        const pubDate = parseRSSDate(item.pubDate || item.published);
                        const link = item.link || item.guid || '';

                        allResults.push({
                            title: title.replace(/\n/g, ' ').trim(),
                            abstract: stripHtml(description).substring(0, 500).trim() || 'No description available.',
                            url: link,
                            source: sourceName,
                            publicationDate: pubDate
                        });
                    }
                }
            } catch (sourceError) {
                const sourceName = getSourceNameFromUrl(rssUrl);
                logger.error(`${sourceName} Feed fetch failed`, { error: sourceError });
                continue;
            }
        }

        // Sort by date and limit results
        return allResults
            .sort((a, b) => b.publicationDate.getTime() - a.publicationDate.getTime())
            .slice(0, limit);

    } catch (error) {
        logger.error("Regulatory Sources Search Failed", { error });
        return [];
    }
}

interface SourceItem {
    name: string;
    type?: string;
    url?: string;
}

export async function searchOnline(query: string = "AI", since?: Date, to?: Date, explicitSources: SourceItem[] = []): Promise<SearchResult[]> {
    logger.debug(`Real Collection Searching for: ${query}`);

    const promises: Promise<SearchResult[]>[] = [];
    const sourceNames: string[] = [];

    // Build source URL map from explicitSources
    const sourceUrlMap = new Map<string, string>();
    explicitSources.forEach(s => {
        sourceUrlMap.set(s.name.toLowerCase(), s.url || '');
    });

    // Map database source names to search functions
    const lowerSources = explicitSources.map(s => s.name.toLowerCase());
    const fetchArxiv = lowerSources.some(s => s.includes("arxiv"));
    const fetchScholar = lowerSources.some(s => s.includes("scholar"));
    const fetchSSRN = lowerSources.some(s => s.includes("ssrn"));
    const fetchIEEE = lowerSources.some(s => s.includes("ieee"));
    const fetchACM = lowerSources.some(s => s.includes("acm"));

    logger.debug(`Real Collection Sources - ArXiv: ${fetchArxiv}, Scholar: ${fetchScholar}, SSRN: ${fetchSSRN}, IEEE: ${fetchIEEE}, ACM: ${fetchACM}`);

    // Search only the explicitly enabled sources with their URLs from database
    if (fetchArxiv) {
        const baseUrl = sourceUrlMap.get('arxiv') || 'https://export.arxiv.org/api/query';
        promises.push(searchArxiv(query, 10, baseUrl));
        sourceNames.push('ArXiv');
    }
    if (fetchScholar) {
        const baseUrl = sourceUrlMap.get('semantic-scholar') || 'https://api.semanticscholar.org/graph/v1';
        promises.push(searchSemanticScholar(query, 10, baseUrl));
        sourceNames.push('Google Scholar');
    }
    if (fetchSSRN) {
        const baseUrl = sourceUrlMap.get('ssrn') || 'https://papers.ssrn.com';
        promises.push(searchSSRN(query, 10, baseUrl));
        sourceNames.push('SSRN');
    }
    // Note: IEEE and ACM use Semantic Scholar as backend since they don't have free APIs
    if (fetchIEEE || fetchACM) {
        const baseUrl = sourceUrlMap.get('semantic-scholar') || 'https://api.semanticscholar.org/graph/v1';
        promises.push(searchSemanticScholar(query, 10, baseUrl));
        if (fetchIEEE) sourceNames.push('IEEE Xplore');
        if (fetchACM) sourceNames.push('ACM Digital Library');
    }

    const results = (await Promise.all(promises)).flat();
    logger.debug(`Real Collection Raw results found: ${results.length}`);

    // Deduplicate by Title
    const seen = new Set();
    const uniqueResults = results.filter(p => {
        const key = p.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    logger.debug(`Real Collection Unique results: ${uniqueResults.length}`);

    // Client-side date filtering
    let filtered = uniqueResults;

    if (since) {
        logger.debug(`Real Collection Filtering since: ${since.toISOString()}`);
        filtered = filtered.filter(p => p.publicationDate >= since);
    }

    if (to) {
        logger.debug(`Real Collection Filtering to: ${to.toISOString()}`);
        filtered = filtered.filter(p => p.publicationDate <= to);
    }

    if (since || to) {
        logger.debug(`Real Collection Results after date filter: ${filtered.length}`);
    }

    return filtered;
}
