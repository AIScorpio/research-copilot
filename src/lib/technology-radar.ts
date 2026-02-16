import { prisma } from './db';

export interface Paper {
    id: string;
    title: string;
    authors?: string;
    abstract?: string;
    publicationDate?: string;
    url?: string;
    relevanceScore?: number;
    technicalScore?: number;
    businessScore?: number;
    timelinessScore?: number;
    practicalityScore?: number;
}

export interface TrendMetric {
    change: number;
    direction: 'up' | 'down' | 'stable';
    currentCount: number;
    previousCount: number;
}

export interface TrendMetrics {
    vsSelectedPeriod: TrendMetric;
    vsLastWeek: TrendMetric;
    isNew: boolean;
}

export interface RadarTechnology {
    id: string;
    name: string;
    quadrant: 'adopt' | 'trial' | 'assess' | 'hold';
    maturity: number;
    relevanceToRisk: number;
    bankAdoption: string[];
    evidenceCount: number;
    recentActivity: boolean;
    description: string;
    relatedTopics: string[];
    papers?: Paper[];
    trendMetrics?: TrendMetrics;
}

export interface RadarData {
    technologies: RadarTechnology[];
    lastUpdated: Date;
    totalTechnologies: number;
    byQuadrant: {
        adopt: number;
        trial: number;
        assess: number;
        hold: number;
    };
}

export async function generateTechnologyRadar(days: number = 90): Promise<RadarData> {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    
    // Define time windows for dual trend calculation
    const currentPeriodStart = new Date(now - days * msPerDay);
    const previousPeriodStart = new Date(now - 2 * days * msPerDay);
    const lastWeekStart = new Date(now - 7 * msPerDay);
    const previousWeekStart = new Date(now - 14 * msPerDay);
    
    // Fetch papers for all periods in parallel
    const [
        currentPeriodPapers,
        previousPeriodPapers,
        lastWeekPapers,
        previousWeekPapers,
        allHistoricalPapers
    ] = await Promise.all([
        // Current period papers (user selected)
        prisma.paper.findMany({
            where: { 
                publicationDate: { gte: currentPeriodStart },
                deletedAt: null
            },
            include: { 
                tags: { 
                    include: { tag: true },
                    where: { 
                        OR: [
                            { tag: { category: 'ai-technology' } },
                            { tag: { category: null } }
                        ]
                    }
                } 
            },
            orderBy: { publicationDate: 'desc' }
        }),
        // Previous period papers (for trend comparison)
        prisma.paper.findMany({
            where: { 
                publicationDate: { 
                    gte: previousPeriodStart,
                    lt: currentPeriodStart 
                },
                deletedAt: null
            },
            include: { 
                tags: { 
                    include: { tag: true },
                    where: { 
                        OR: [
                            { tag: { category: 'ai-technology' } },
                            { tag: { category: null } }
                        ]
                    }
                } 
            }
        }),
        // Last week papers
        prisma.paper.findMany({
            where: { 
                publicationDate: { gte: lastWeekStart },
                deletedAt: null
            },
            include: { 
                tags: { 
                    include: { tag: true },
                    where: { 
                        OR: [
                            { tag: { category: 'ai-technology' } },
                            { tag: { category: null } }
                        ]
                    }
                } 
            }
        }),
        // Previous week papers
        prisma.paper.findMany({
            where: { 
                publicationDate: { 
                    gte: previousWeekStart,
                    lt: lastWeekStart 
                },
                deletedAt: null
            },
            include: { 
                tags: { 
                    include: { tag: true },
                    where: { 
                        OR: [
                            { tag: { category: 'ai-technology' } },
                            { tag: { category: null } }
                        ]
                    }
                } 
            }
        }),
        // All historical papers for "NEW" detection
        prisma.paper.findMany({
            where: { deletedAt: null },
            include: { 
                tags: { 
                    include: { tag: true },
                    where: { 
                        OR: [
                            { tag: { category: 'ai-technology' } },
                            { tag: { category: null } }
                        ]
                    }
                } 
            }
        })
    ]);

    const technologies = analyzeTechnologies(
        currentPeriodPapers,
        previousPeriodPapers,
        lastWeekPapers,
        previousWeekPapers,
        allHistoricalPapers
    );
    
    return {
        technologies,
        lastUpdated: new Date(),
        totalTechnologies: technologies.length,
        byQuadrant: {
            adopt: technologies.filter(t => t.quadrant === 'adopt').length,
            trial: technologies.filter(t => t.quadrant === 'trial').length,
            assess: technologies.filter(t => t.quadrant === 'assess').length,
            hold: technologies.filter(t => t.quadrant === 'hold').length
        }
    };
}

function analyzeTechnologies(
    currentPeriodPapers: any[],
    previousPeriodPapers: any[],
    lastWeekPapers: any[],
    previousWeekPapers: any[],
    allHistoricalPapers: any[]
): RadarTechnology[] {
    // Group papers by technology for each period
    const currentTechGroups = groupPapersByTechnology(currentPeriodPapers);
    const previousTechGroups = groupPapersByTechnology(previousPeriodPapers);
    const lastWeekTechGroups = groupPapersByTechnology(lastWeekPapers);
    const previousWeekTechGroups = groupPapersByTechnology(previousWeekPapers);
    const allTimeTechGroups = groupPapersByTechnology(allHistoricalPapers);

    const radarTechs: RadarTechnology[] = [];

    // Process each technology found in current period
    for (const [techName, currentPapers] of Object.entries(currentTechGroups)) {
        if (currentPapers.length < 2) continue; // Need at least 2 papers

        const previousPapers = previousTechGroups[techName] || [];
        const lastWeekPapersForTech = lastWeekTechGroups[techName] || [];
        const previousWeekPapersForTech = previousWeekTechGroups[techName] || [];
        const allTimePapers = allTimeTechGroups[techName] || [];

        const radarTech = createRadarTechnology(
            techName,
            currentPapers,
            previousPapers,
            lastWeekPapersForTech,
            previousWeekPapersForTech,
            allTimePapers
        );
        
        if (radarTech) {
            radarTechs.push(radarTech);
        }
    }

    return radarTechs.sort((a, b) => b.relevanceToRisk - a.relevanceToRisk);
}

function groupPapersByTechnology(papers: any[]): Record<string, any[]> {
    const techGroups: Record<string, any[]> = {};

    for (const paper of papers) {
        const tags = paper.tags.map((pt: any) => pt.tag.name);
        const technologies = extractTechnologiesFromTags(tags, paper.title, paper.abstract);
        
        for (const tech of technologies) {
            if (!techGroups[tech]) {
                techGroups[tech] = [];
            }
            techGroups[tech].push(paper);
        }
    }

    return techGroups;
}

function extractTechnologiesFromTags(tags: string[], title: string, abstract: string | null): string[] {
    const allText = `${title} ${abstract || ''} ${tags.join(' ')}`.toLowerCase();
    const technologies: string[] = [];

    const techKeywords = [
        'deep learning', 'neural network', 'llm', 'language model',
        'graph neural network', 'knowledge graph', 'graph analytics',
        'nlp', 'natural language', 'text analysis',
        'computer vision', 'image recognition',
        'time series', 'forecasting', 'prediction',
        'anomaly detection', 'fraud detection',
        'reinforcement learning', 'agent',
        'credit scoring', 'credit risk',
        'regtech', 'suptech',
        'quantum', 'blockchain', 'cryptocurrency',
        'generative ai', 'chatgpt', 'gpt'
    ];

    for (const tech of techKeywords) {
        if (allText.includes(tech)) {
            technologies.push(capitalizeWords(tech));
        }
    }

    return [...new Set(technologies)];
}

function createRadarTechnology(
    name: string,
    currentPapers: any[],
    previousPapers: any[],
    lastWeekPapers: any[],
    previousWeekPapers: any[],
    allTimePapers: any[]
): RadarTechnology | null {
    const recentPapers = currentPapers.filter((p: any) => {
        const daysSince = (Date.now() - new Date(p.publicationDate).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince < 90;
    });

    const maturity = calculateMaturity(currentPapers, recentPapers);
    const relevanceToRisk = calculateRelevance(currentPapers);
    const quadrant = determineQuadrant(maturity, relevanceToRisk);
    const bankAdoption = inferBankAdoption(currentPapers, name);

    const relatedTopics = currentPapers
        .flatMap((p: any) => p.tags.map((pt: any) => pt.tag.name))
        .filter((t: string) => !t.toLowerCase().includes(name.toLowerCase()));

    // Calculate dual trend metrics
    const trendMetrics = calculateTrendMetrics(
        currentPapers.length,
        previousPapers.length,
        lastWeekPapers.length,
        previousWeekPapers.length,
        allTimePapers.length
    );

    return {
        id: `tech-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        name,
        quadrant,
        maturity,
        relevanceToRisk,
        bankAdoption,
        evidenceCount: currentPapers.length,
        recentActivity: recentPapers.length > 0,
        description: generateDescription(name, quadrant, maturity),
        relatedTopics: [...new Set(relatedTopics)].slice(0, 5),
        trendMetrics,
        papers: currentPapers.map(p => ({
            id: p.id,
            title: p.title,
            authors: p.authors,
            abstract: p.abstract,
            publicationDate: p.publicationDate?.toISOString(),
            url: p.url,
            relevanceScore: p.relevanceScore,
            technicalScore: p.technicalScore,
            businessScore: p.businessScore,
            timelinessScore: p.timelinessScore,
            practicalityScore: p.practicalityScore
        }))
    };
}

function calculateTrendMetrics(
    currentCount: number,
    previousCount: number,
    lastWeekCount: number,
    previousWeekCount: number,
    allTimeCount: number
): TrendMetrics {
    // Calculate vsSelectedPeriod trend
    const vsSelectedPeriod = calculateTrend(currentCount, previousCount);
    
    // Calculate vsLastWeek trend
    const vsLastWeek = calculateTrend(lastWeekCount, previousWeekCount);
    
    // Determine if technology is NEW
    // NEW if: total historical papers < 3 AND at least 1 paper in current period
    const isNew = allTimeCount < 3 && currentCount >= 1;

    return {
        vsSelectedPeriod,
        vsLastWeek,
        isNew
    };
}

function calculateTrend(current: number, previous: number): TrendMetric {
    let change: number;
    let direction: 'up' | 'down' | 'stable';

    if (previous === 0) {
        // If no papers in previous period, treat as 100% increase if current > 0
        change = current > 0 ? 100 : 0;
        direction = current > 0 ? 'up' : 'stable';
    } else {
        change = ((current - previous) / previous) * 100;
        
        if (change > 5) {
            direction = 'up';
        } else if (change < -5) {
            direction = 'down';
        } else {
            direction = 'stable';
        }
    }

    return {
        change: Math.round(change),
        direction,
        currentCount: current,
        previousCount: previous
    };
}

function calculateMaturity(allPapers: any[], recentPapers: any[]): number {
    let score = 20; // Base score

    if (allPapers.length >= 3) score += 20;
    if (allPapers.length >= 5) score += 10;
    if (allPapers.length >= 10) score += 10;

    if (recentPapers.length >= 2) score += 10;
    if (recentPapers.length >= 5) score += 10;
    if (recentPapers.length >= 10) score += 10;

    const mentionsInProduction = allPapers.some((p: any) => {
        const text = `${p.title} ${p.abstract || ''}`.toLowerCase();
        return text.includes('production') || text.includes('implemented') || text.includes('deployed');
    });
    if (mentionsInProduction) score += 10;

    return Math.min(score, 100);
}

function calculateRelevance(papers: any[]): number {
    let score = 30; // Base score

    const riskRelatedKeywords = ['risk', 'compliance', 'fraud', 'aml', 'regulatory', 'security'];
    const hasRiskRelevance = papers.some((p: any) => {
        const text = `${p.title} ${p.abstract || ''}`.toLowerCase();
        return riskRelatedKeywords.some(kw => text.includes(kw));
    });
    if (hasRiskRelevance) score += 40;

    const bankingKeywords = ['banking', 'finance', 'fintech', 'financial'];
    const hasBankingRelevance = papers.some((p: any) => {
        const text = `${p.title} ${p.abstract || ''}`.toLowerCase();
        return bankingKeywords.some(kw => text.includes(kw));
    });
    if (hasBankingRelevance) score += 20;

    const recentActivity = papers.filter((p: any) => {
        const daysSince = (Date.now() - new Date(p.publicationDate).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince < 60;
    });
    if (recentActivity.length >= 3) score += 10;

    return Math.min(score, 100);
}

function determineQuadrant(maturity: number, relevance: number): 'adopt' | 'trial' | 'assess' | 'hold' {
    if (maturity >= 70 && relevance >= 70) return 'adopt';
    if (maturity >= 50 && relevance >= 50) return 'trial';
    if (maturity >= 30) return 'assess';
    return 'hold';
}

function inferBankAdoption(papers: any[], _techName: string): string[] {
    const mentions: string[] = [];

    const bankPatterns = [
        /jpmorgan|j.p. morgan/gi,
        /goldman sachs/gi,
        /morgan stanley/gi,
        /barclays/gi,
        /hsbc/gi,
        /citigroup/gi,
        /bank of america/gi
    ];

    for (const paper of papers) {
        const text = `${paper.title} ${paper.abstract || ''}`;
        
        for (const pattern of bankPatterns) {
            const match = text.match(pattern);
            if (match) {
                const bankName = match[0].trim();
                if (!mentions.includes(bankName)) {
                    mentions.push(bankName);
                }
            }
        }
    }

    if (mentions.length === 0) {
        return ['Industry Research'];
    }

    return mentions.slice(0, 3);
}

function generateDescription(name: string, quadrant: string, maturity: number): string {
    const maturityLevel = maturity >= 70 ? 'mature' : maturity >= 50 ? 'established' : maturity >= 30 ? 'emerging' : 'early';
    const quadrantDesc = {
        adopt: 'ready for production',
        trial: 'suitable for pilot programs',
        assess: 'worth investigating',
        hold: 'monitor for developments'
    };
    
    return `${name} is a ${maturityLevel} technology that is ${quadrantDesc[quadrant as keyof typeof quadrantDesc]}.`;
}

function capitalizeWords(str: string): string {
    return str.replace(/\b\w/g, char => char.toUpperCase());
}