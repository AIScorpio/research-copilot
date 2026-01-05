import { XMLParser } from "fast-xml-parser";

export interface SearchResult {
    title: string;
    abstract: string;
    url: string;
    source: string;
    publicationDate: Date;
}

const parser = new XMLParser({ ignoreAttributes: false });

async function searchArxiv(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
        // ArXiv API: http://export.arxiv.org/api/query?search_query=all:electron&start=0&max_results=10
        const encodedQuery = encodeURIComponent(query);
        const res = await fetch(`http://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`);
        const xml = await res.text();
        const data = parser.parse(xml);

        const entries = data.feed?.entry || [];
        const list = Array.isArray(entries) ? entries : [entries];

        return list.map((entry: any) => ({
            title: typeof entry.title === 'string' ? entry.title.replace(/\n/g, ' ').trim() : "No Title",
            abstract: typeof entry.summary === 'string' ? entry.summary.replace(/\n/g, ' ').trim() : "",
            url: entry.id,
            source: "ArXiv",
            publicationDate: new Date(entry.published),
        })).filter((p: any) => p.title !== "No Title");
    } catch (error) {
        console.error("ArXiv Search Failed:", error);
        return [];
    }
}

async function searchSemanticScholar(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
        // Semantic Scholar Graph API
        const encodedQuery = encodeURIComponent(query);
        const res = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedQuery}&limit=${limit}&fields=title,abstract,url,venue,publicationDate`);
        const data = await res.json();

        if (!data.data) return [];

        return data.data.map((paper: any) => ({
            title: paper.title,
            abstract: paper.abstract || "No abstract available.",
            url: paper.url || paper.openAccessPdf?.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
            source: paper.venue || "Semantic Scholar",
            publicationDate: paper.publicationDate ? new Date(paper.publicationDate) : new Date('2000-01-01'), // Fallback to year 2000 instead of today
        }));
    } catch (error) {
        console.error("Semantic Scholar Search Failed:", error);
        return [];
    }
}

async function searchSSRN(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
        // SSRN doesn't have a free public API, but we can scrape their RSS feed or search page
        // For now, implementing a basic RSS feed search
        const encodedQuery = encodeURIComponent(query);

        // SSRN search URL returns HTML, but we can parse their recent papers feed
        // Alternative: Use their advanced search which returns results in a parseable format
        const res = await fetch(`https://papers.ssrn.com/sol3/JELJOUR_Results.cfm?form_name=journalBrowse&journal_id=&Network=no&lim=false&npage=1&nper_page=${limit}`);

        if (!res.ok) {
            console.warn(`[SSRN] Search returned ${res.status}`);
            return [];
        }

        // Note: SSRN doesn't provide a clean API, so results would need HTML parsing
        // For now, returning empty array - would need cheerio or similar for scraping
        console.warn('[SSRN] API integration requires HTML parsing - not yet implemented');
        return [];

    } catch (error) {
        console.error("SSRN Search Failed:", error);
        return [];
    }
}

export async function searchOnline(query: string = "AI", since?: Date, to?: Date, explicitSources: any[] = []): Promise<SearchResult[]> {
    console.log(`[Real Collection] Searching for: ${query}`);

    // Determine which APIs to call based on explicitSources or defaults
    const lowerSources = explicitSources.map(s => s.name.toLowerCase());
    const fetchArxiv = lowerSources.length === 0 || lowerSources.some(s => s.includes("arxiv"));
    const fetchScholar = lowerSources.length === 0 || lowerSources.some(s => s.includes("scholar") || s.includes("acm") || s.includes("ieee"));
    const fetchSSRN = lowerSources.some(s => s.includes("ssrn"));

    console.log(`[Real Collection] Sources - ArXiv: ${fetchArxiv}, Scholar: ${fetchScholar}, SSRN: ${fetchSSRN}`);

    const promises: Promise<SearchResult[]>[] = [];

    // Prioritize ArXiv as it's the most open/reliable free API
    if (fetchArxiv) promises.push(searchArxiv(query, 10)); // Fetch 10 to filter down
    if (fetchScholar) promises.push(searchSemanticScholar(query, 10));
    if (fetchSSRN) promises.push(searchSSRN(query, 10));

    const results = (await Promise.all(promises)).flat();
    console.log(`[Real Collection] Raw results found: ${results.length}`);

    // Deduplicate by Title
    const seen = new Set();
    const uniqueResults = results.filter(p => {
        const key = p.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    console.log(`[Real Collection] Unique results: ${uniqueResults.length}`);

    // Client-side date filtering
    let filtered = uniqueResults;

    if (since) {
        console.log(`[Real Collection] Filtering since: ${since.toISOString()}`);
        filtered = filtered.filter(p => p.publicationDate >= since);
    }

    if (to) {
        console.log(`[Real Collection] Filtering to: ${to.toISOString()}`);
        filtered = filtered.filter(p => p.publicationDate <= to);
    }

    if (since || to) {
        console.log(`[Real Collection] Results after date filter: ${filtered.length}`);
    }

    return filtered;
}
