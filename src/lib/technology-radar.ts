import { prisma } from './db';

export interface RadarTechnology {
    id: string;
    name: string;
    quadrant: 'adopt' | 'trial' | 'assess' | 'hold';
    maturity: number; // 0-100
    relevanceToRisk: number; // 0-100
    bankAdoption: string[]; // Which banks/organizations are using it
    evidenceCount: number; // Number of papers supporting this
    recentActivity: boolean; // Has activity in last 90 days
    description: string;
    relatedTopics: string[];
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
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const recentPapers = await prisma.paper.findMany({
        where: {
            publicationDate: { gte: sinceDate }
        },
        include: {
            tags: {
                include: {
                    tag: true
                }
            }
        },
        orderBy: {
            publicationDate: 'desc'
        }
    });

    const technologies = analyzeTechnologies(recentPapers);
    
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

function analyzeTechnologies(papers: any[]): RadarTechnology[] {
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

    const radarTechs: RadarTechnology[] = [];

    for (const [techName, papersForTech] of Object.entries(techGroups)) {
        if (papersForTech.length < 2) continue; // Need at least 2 papers

        const radarTech = createRadarTechnology(techName, papersForTech);
        if (radarTech) {
            radarTechs.push(radarTech);
        }
    }

    return radarTechs.sort((a, b) => b.relevanceToRisk - a.relevanceToRisk);
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

function createRadarTechnology(name: string, papers: any[]): RadarTechnology | null {
    const recentPapers = papers.filter((p: any) => {
        const daysSince = (Date.now() - new Date(p.publicationDate).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince < 90;
    });

    const maturity = calculateMaturity(papers, recentPapers);
    const relevanceToRisk = calculateRelevance(papers);
    const quadrant = determineQuadrant(maturity, relevanceToRisk);
    const bankAdoption = inferBankAdoption(papers, name);

    const relatedTopics = papers
        .flatMap((p: any) => p.tags.map((pt: any) => pt.tag.name))
        .filter((t: string) => !t.toLowerCase().includes(name.toLowerCase()));

    return {
        id: `tech-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        name,
        quadrant,
        maturity,
        relevanceToRisk,
        bankAdoption,
        evidenceCount: papers.length,
        recentActivity: recentPapers.length > 0,
        description: generateDescription(name, quadrant, maturity),
        relatedTopics: [...new Set(relatedTopics)].slice(0, 5)
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
    if (maturity >= 70 && relevance >= 70) {
        return 'adopt';
    } else if (maturity >= 50 && relevance >= 50) {
        return 'trial';
    } else if (maturity >= 30) {
        return 'assess';
    } else {
        return 'hold';
    }
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

function generateDescription(name: string, quadrant: string, _maturity: number): string {
    const quadrantDesc: Record<string, string> = {
        'adopt': 'Proven technology ready for production deployment',
        'trial': 'Mature technology suitable for pilot programs',
        'assess': 'Emerging technology worth investigating',
        'hold': 'Experimental approach, monitor for developments'
    };

    return `${name}: ${quadrantDesc[quadrant] || 'Technology under evaluation'}`;
}

function capitalizeWords(str: string): string {
    return str
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}