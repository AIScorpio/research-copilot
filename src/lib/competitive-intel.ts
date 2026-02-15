import { prisma } from './db';
import { logger } from './logger';

export interface CompetitiveUpdate {
    id: string;
    type: 'publication' | 'patent' | 'news';
    institution: string;
    title: string;
    url: string;
    publicationDate: Date;
    summary?: string;
    relevanceScore: number; // 0-100
    relevantTopics: string[];
    createdAt: Date;
}

export interface PatentInfo {
    id: string;
    title: string;
    assignee: string;
    publicationDate: Date;
    url: string;
    abstract?: string;
    inventors: string[];
    relevantToBanking: boolean;
}

/**
 * Track competitive intelligence from major banks
 * Monitors publications and patent filings from JPMorgan, Goldman Sachs, etc.
 */
export async function trackCompetitiveUpdates(since: Date): Promise<CompetitiveUpdate[]> {
    try {
        const updates: CompetitiveUpdate[] = [];

        // Monitor key competitors
        const competitors = [
            'JPMorgan Chase',
            'Goldman Sachs',
            'Bank of America',
            'Citigroup',
            'Morgan Stanley',
            'HSBC',
            'Barclays'
        ];

        for (const competitor of competitors) {
            // Search for recent publications
            const publications = await searchAcademicPublications(competitor, since);
            updates.push(...publications);

            // Search for patents (if available via API)
            const patents = await searchPatents(competitor, since);
            updates.push(...patents);

            // Search for news/announcements
            const news = await searchBankingNews(competitor, since);
            updates.push(...news);
        }

        // Sort by relevance and date
        return updates
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .sort((a, b) => b.publicationDate.getTime() - a.publicationDate.getTime())
            .slice(0, 50); // Top 50 updates
    } catch (error) {
        logger.error('Competitive Intelligence Tracking failed', { error });
        return [];
    }
}

/**
 * Search academic publications from Semantic Scholar
 */
async function searchAcademicPublications(
    institution: string,
    since: Date
): Promise<CompetitiveUpdate[]> {
    try {
        const encodedQuery = encodeURIComponent(`"${institution}" AI OR machine learning OR fintech`);
        const response = await fetch(
            `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedQuery}&limit=5&fields=title,abstract,url,venue,publicationDate,authors`
        );

        if (!response.ok) return [];

        const data = await response.json();
        if (!data.data) return [];

        const updates: CompetitiveUpdate[] = data.data
            .filter((paper: any) => {
                const pubDate = new Date(paper.publicationDate || '2000-01-01');
                return pubDate >= since;
            })
            .map((paper: any) => ({
                id: `pub-${paper.paperId}`,
                type: 'publication' as const,
                institution,
                title: paper.title,
                url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
                publicationDate: new Date(paper.publicationDate || '2000-01-01'),
                summary: paper.abstract?.substring(0, 300),
                relevanceScore: calculateRelevanceScore(paper, ['AI', 'machine learning', 'fintech', 'banking']),
                relevantTopics: extractRelevantTopics(paper.title + ' ' + (paper.abstract || ''), [
                    'AI', 'ML', 'NLP', 'Deep Learning', 'Risk', 'Fraud', 'Compliance', 'Trading', 'Portfolio'
                ]),
                createdAt: new Date()
            }));

        return updates;
    } catch (error) {
        logger.error(`Competitive Intelligence Academic search failed for ${institution}`, { error });
        return [];
    }
}

/**
 * Search patents from USPTO/EPO
 * Note: This is a simplified implementation
 */
async function searchPatents(
    assignee: string,
    _since: Date
): Promise<CompetitiveUpdate[]> {
    try {
        // USPTO Patent Search API (requires API key)
        // Using a simplified approach - in production, use proper patent APIs

        // For demonstration, returning empty array
        // In production, integrate with:
        // - USPTO Patent Center API
        // - EPO OPS API
        // - Google Patents API
        
        return [];
        
    } catch (error) {
        logger.error(`Competitive Intelligence Patent search failed for ${assignee}`, { error });
        return [];
    }
}

/**
 * Search banking news for competitor mentions
 */
async function searchBankingNews(
    institution: string,
    since: Date
): Promise<CompetitiveUpdate[]> {
    try {
        // Search existing database for news mentioning the institution
        const news = await prisma.paper.findMany({
            where: {
                AND: [
                    { publicationDate: { gte: since } },
                    {
                        OR: [
                            { title: { contains: institution } },
                            { abstract: { contains: institution } }
                        ]
                    }
                ]
            },
            orderBy: { publicationDate: 'desc' },
            take: 3
        });

        return news.map(paper => ({
            id: `news-${paper.id}`,
            type: 'news' as const,
            institution,
            title: paper.title,
            url: paper.url,
            publicationDate: paper.publicationDate,
            summary: paper.abstract?.substring(0, 300),
            relevanceScore: 50,
            relevantTopics: [],
            createdAt: new Date()
        }));
    } catch (error) {
        logger.error(`Competitive Intelligence News search failed for ${institution}`, { error });
        return [];
    }
}

/**
 * Calculate relevance score based on keyword matching
 */
function calculateRelevanceScore(content: any, keywords: string[]): number {
    const text = `${content.title} ${content.abstract || ''} ${content.venue || ''}`.toLowerCase();
    
    let score = 20; // Base score for being from a competitor
    
    keywords.forEach(keyword => {
        if (text.includes(keyword.toLowerCase())) {
            score += 10;
        }
    });
    
    // Check for high-relevance phrases
    const highRelevancePhrases = [
        'banking', 'fintech', 'financial services', 'investment banking',
        'risk management', 'compliance', 'trading', 'fraud detection',
        'credit risk', 'market risk', 'operational risk'
    ];
    
    highRelevancePhrases.forEach(phrase => {
        if (text.includes(phrase)) {
            score += 15;
        }
    });
    
    return Math.min(score, 100);
}

/**
 * Extract relevant topics from content
 */
function extractRelevantTopics(text: string, topicList: string[]): string[] {
    const found: string[] = [];
    const lowerText = text.toLowerCase();
    
    topicList.forEach(topic => {
        if (lowerText.includes(topic.toLowerCase())) {
            found.push(topic);
        }
    });
    
    return found.slice(0, 5); // Top 5 topics
}

/**
 * Generate competitive intelligence brief
 */
export async function generateCompetitiveBrief(days: number = 30): Promise<{
    summary: string;
    topCompetitors: string[];
    keyTrends: string[];
    alertTopics: string[];
}> {
    try {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const updates = await trackCompetitiveUpdates(since);
        
        // Group by competitor
        const competitorActivity: Record<string, CompetitiveUpdate[]> = {};
        updates.forEach(update => {
            if (!competitorActivity[update.institution]) {
                competitorActivity[update.institution] = [];
            }
            competitorActivity[update.institution].push(update);
        });
        
        // Find most active competitors
        const topCompetitors = Object.entries(competitorActivity)
            .sort(([, a], [, b]) => b.length - a.length)
            .slice(0, 3)
            .map(([name]) => name);
        
        // Extract key trends
        const allTopics = updates.flatMap(u => u.relevantTopics);
        const topicCounts: Record<string, number> = {};
        allTopics.forEach(topic => {
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });
        
        const keyTrends = Object.entries(topicCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([topic]) => topic);
        
        // Identify alert topics (high activity)
        const alertTopics = keyTrends.filter(topic => {
            const count = topicCounts[topic];
            return count >= 5; // 5+ mentions is significant
        });
        
        return {
            summary: `Competitive intelligence brief covering the last ${days} days. ` +
                    `Monitored ${Object.keys(competitorActivity).length} competitors. ` +
                    `Found ${updates.length} relevant updates.`,
            topCompetitors,
            keyTrends,
            alertTopics
        };
    } catch (error) {
        logger.error('Competitive Intelligence Brief generation failed', { error });
        return {
            summary: 'Failed to generate brief',
            topCompetitors: [],
            keyTrends: [],
            alertTopics: []
        };
    }
}

/**
 * Save competitive update to database
 * Note: Would need a CompetitiveUpdate table in schema
 */
export async function saveCompetitiveUpdate(update: CompetitiveUpdate): Promise<void> {
    logger.debug(`Competitive Intelligence Update: ${update.title}`);
    // Placeholder - would save to CompetitiveUpdate table
}
