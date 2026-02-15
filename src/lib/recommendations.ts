import { prisma } from './db';
import { logger } from './logger';

export enum ReadinessLevel {
    EMERGING = 'EMERGING',
    PILOT_READY = 'PILOT_READY',
    PRODUCTION = 'PRODUCTION',
    MATURE = 'MATURE'
}

export interface BankingTag {
    id: string;
    name: string;
    category: string;
}

export interface PoCRecommendation {
    id: string;
    title: string;
    domain: string;
    description: string;
    technology: string;
    riskDomain: string;
    readiness: ReadinessLevel;
    readinessScore: number;
    estimatedEffort: 'Low' | 'Medium' | 'High';
    businessValue: 'Low' | 'Medium' | 'High';
    bankingTags: string[];
    bankingUseCases: string[];
    relatedPapers: Array<{
        id: string;
        title: string;
        url: string;
    }>;
    confidence: number; // 0-1
    bankAdoption?: string[];
    maturityIndicators?: string[];
    createdAt: Date;
}

export const BANKING_TAXONOMY = {
    riskDomains: [
        'Credit Risk',
        'Market Risk',
        'Operational Risk',
        'Liquidity Risk',
        'Cyber Risk',
        'Model Risk',
        'Regulatory Risk'
    ],
    aiTechnologies: [
        'Deep Learning',
        'Graph Neural Networks',
        'NLP',
        'LLM Applications',
        'Computer Vision',
        'Time Series Analysis',
        'Reinforcement Learning',
        'Graph Analytics',
        'Anomaly Detection',
        'Predictive Modeling',
        'NLP Compliance'
    ],
    useCases: [
        'Fraud Detection',
        'AML Monitoring',
        'Credit Scoring',
        'Customer Churn',
        'Sentiment Analysis',
        'Document Processing',
        'Risk Prediction',
        'Regulatory Compliance',
        'Model Governance',
        'Basel Compliance'
    ],
    maturityKeywords: {
        [ReadinessLevel.EMERGING]: ['research', 'experimental', 'novel', 'theoretical', 'exploratory'],
        [ReadinessLevel.PILOT_READY]: ['pilot', 'poc', 'prototype', 'trial', 'initial'],
        [ReadinessLevel.PRODUCTION]: ['production', 'implemented', 'deployed', 'real-world', 'operational'],
        [ReadinessLevel.MATURE]: ['mature', 'established', 'standard', 'industry', 'proven']
    }
};

export async function generatePoCRecommendations(limit: number = 10, domain?: string): Promise<PoCRecommendation[]> {
    const bankingTags = await fetchBankingTags();
    
    const recentPapers = await prisma.paper.findMany({
        where: {
            publicationDate: {
                gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            },
            ...(domain && {
                tags: {
                    some: {
                        tag: {
                            name: { contains: domain }
                        }
                    }
                }
            })
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
        },
        take: 100
    });

    const recommendations: PoCRecommendation[] = [];
    const paperGroups = groupPapersByTopic(recentPapers, bankingTags);

    for (const [topic, papers] of Object.entries(paperGroups)) {
        if (recommendations.length >= limit) break;
        if (papers.length < 2) continue;

        const recommendation = analyzeTopicForPoC(topic, papers, bankingTags);
        if (recommendation) {
            recommendations.push(recommendation);
        }
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}

async function fetchBankingTags(): Promise<BankingTag[]> {
    const tags = await prisma.tag.findMany({
        where: {
            type: 'Banking'
        }
    });
    
    return tags.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        category: tag.category || 'uncategorized'
    }));
}

function groupPapersByTopic(papers: any[], bankingTags: BankingTag[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};

    for (const paper of papers) {
        const tags = paper.tags.map((pt: any) => pt.tag.name);
        
        const relevantTag = tags.find((tag: string) => 
            BANKING_TAXONOMY.aiTechnologies.some(t => tag.includes(t)) ||
            BANKING_TAXONOMY.useCases.some(t => tag.includes(t)) ||
            bankingTags.some(bt => tag === bt.name)
        );

        if (relevantTag) {
            const key = relevantTag;
            if (!groups[key]) groups[key] = [];
            groups[key].push(paper);
        }
    }

    return groups;
}

function analyzeTopicForPoC(topic: string, papers: any[], bankingTags: BankingTag[]): PoCRecommendation | null {
    const technology = BANKING_TAXONOMY.aiTechnologies.find(t => topic.includes(t)) || topic;
    const useCase = BANKING_TAXONOMY.useCases.find(uc => 
        papers.some((p: any) => p.tags.some((pt: any) => pt.tag.name.includes(uc)))
    ) || 'General Application';

    const riskDomain = inferRiskDomain(papers);
    const domain = inferDomain(papers, bankingTags);
    const confidence = calculateConfidence(papers);
    const readiness = calculateReadiness(papers);
    const readinessScore = calculateReadinessScore(papers, readiness);
    const relevantBankingTags = extractBankingTags(papers, bankingTags);
    const bankingUseCases = generateBankingUseCases(technology, riskDomain, relevantBankingTags);
    const bankAdoption = inferBankAdoption(papers);
    const maturityIndicators = extractMaturityIndicators(papers);

    if (confidence < 0.3) return null;

    return {
        id: `poc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: `PoC: ${technology} for ${useCase}`,
        domain,
        description: `Explore ${technology} applications in ${useCase} based on recent research trends. ${papers.length} relevant papers found in the last 90 days.`,
        technology,
        riskDomain,
        readiness,
        readinessScore,
        estimatedEffort: estimateEffort(technology, useCase),
        businessValue: estimateBusinessValue(riskDomain, technology),
        bankingTags: relevantBankingTags,
        bankingUseCases,
        relatedPapers: papers.map((p: any) => ({
            id: p.id,
            title: p.title,
            url: p.url
        })),
        confidence,
        bankAdoption,
        maturityIndicators,
        createdAt: new Date()
    };
}

function inferDomain(papers: any[], bankingTags: BankingTag[]): string {
    const domainKeywords: Record<string, string[]> = {
        'Credit Risk': ['credit', 'scoring', 'default', 'loan'],
        'Market Risk': ['market', 'portfolio', 'trading', 'var'],
        'Operational Risk': ['operational', 'efficiency', 'automation'],
        'Cyber Risk': ['security', 'fraud', 'malware', 'attack'],
        'Regulatory Risk': ['compliance', 'regulatory', 'governance'],
        'Fraud Detection': ['fraud', 'anomaly', 'detection'],
        'Compliance': ['compliance', 'regulatory', 'nlp compliance']
    };

    for (const paper of papers) {
        const text = `${paper.title} ${paper.abstract || ''}`.toLowerCase();
        for (const [domain, keywords] of Object.entries(domainKeywords)) {
            if (keywords.some(kw => text.includes(kw))) {
                return domain;
            }
        }
    }

    const paperTags = papers.flatMap((p: any) => p.tags.map((pt: any) => pt.tag.name));
    const bankingTag = bankingTags.find(bt => paperTags.includes(bt.name));
    if (bankingTag) {
        return bankingTag.category || 'General';
    }

    return 'General Banking';
}

function inferRiskDomain(papers: any[]): string {
    const riskKeywords: Record<string, string[]> = {
        'Credit Risk': ['credit', 'scoring', 'default', 'loan'],
        'Market Risk': ['market', 'portfolio', 'trading', 'asset'],
        'Operational Risk': ['operational', 'efficiency', 'automation'],
        'Cyber Risk': ['security', 'fraud', 'malware', 'attack'],
        'Regulatory Risk': ['compliance', 'regulatory', 'governance']
    };

    for (const paper of papers) {
        const text = `${paper.title} ${paper.abstract || ''}`.toLowerCase();
        for (const [domain, keywords] of Object.entries(riskKeywords)) {
            if (keywords.some(kw => text.includes(kw))) {
                return domain;
            }
        }
    }

    return 'General Risk';
}

function calculateConfidence(papers: any[]): number {
    let score = 0.3;

    if (papers.length >= 3) score += 0.2;
    if (papers.length >= 5) score += 0.2;

    const avgCitations = papers.reduce((sum: number, p: any) => {
        return sum + (p.citations || 0);
    }, 0) / papers.length;

    if (avgCitations > 10) score += 0.1;
    if (avgCitations > 20) score += 0.1;

    const hasTagOverlap = papers.some((p1: any) => 
        papers.some((p2: any) => 
            p1.id !== p2.id &&
            p1.tags.some((t1: any) => 
                p2.tags.some((t2: any) => t1.tag.name === t2.tag.name)
            )
        )
    );
    if (hasTagOverlap) score += 0.1;

    return Math.min(score, 1.0);
}

function estimateEffort(technology: string, _useCase: string): 'Low' | 'Medium' | 'High' {
    const lowEffort = ['NLP', 'Time Series Analysis'];
    const highEffort = ['Reinforcement Learning', 'Graph Neural Networks', 'Computer Vision'];

    if (lowEffort.some(t => technology.includes(t))) return 'Low';
    if (highEffort.some(t => technology.includes(t))) return 'High';
    return 'Medium';
}

function estimateBusinessValue(riskDomain: string, technology: string): 'Low' | 'Medium' | 'High' {
    const highValueDomains = ['Credit Risk', 'Market Risk', 'Cyber Risk', 'Regulatory Risk'];
    const highValueTech = ['Deep Learning', 'LLM Applications', 'Graph Neural Networks'];

    let score = 0;
    if (highValueDomains.some(d => riskDomain.includes(d))) score += 1;
    if (highValueTech.some(t => technology.includes(t))) score += 1;

    if (score === 2) return 'High';
    if (score === 1) return 'Medium';
    return 'Low';
}

function calculateReadiness(papers: any[]): ReadinessLevel {
    const text = papers.map((p: any) => `${p.title} ${p.abstract || ''}`).join(' ').toLowerCase();
    
    const productionKeywords = BANKING_TAXONOMY.maturityKeywords[ReadinessLevel.PRODUCTION];
    const pilotKeywords = BANKING_TAXONOMY.maturityKeywords[ReadinessLevel.PILOT_READY];
    const matureKeywords = BANKING_TAXONOMY.maturityKeywords[ReadinessLevel.MATURE];

    if (matureKeywords.some(kw => text.includes(kw))) return ReadinessLevel.MATURE;
    if (productionKeywords.some(kw => text.includes(kw))) return ReadinessLevel.PRODUCTION;
    if (pilotKeywords.some(kw => text.includes(kw))) return ReadinessLevel.PILOT_READY;
    
    return ReadinessLevel.EMERGING;
}

function calculateReadinessScore(papers: any[], readiness: ReadinessLevel): number {
    let score = 30;
    
    if (readiness === ReadinessLevel.MATURE) score += 40;
    else if (readiness === ReadinessLevel.PRODUCTION) score += 30;
    else if (readiness === ReadinessLevel.PILOT_READY) score += 20;
    else score += 0;

    if (papers.length >= 5) score += 15;
    else if (papers.length >= 3) score += 10;
    else if (papers.length >= 2) score += 5;

    const recentPapers = papers.filter((p: any) => {
        const daysDiff = (Date.now() - p.publicationDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 30;
    });
    
    if (recentPapers.length >= 3) score += 10;
    else if (recentPapers.length >= 1) score += 5;

    const avgCitations = papers.reduce((sum: number, p: any) => sum + (p.citations || 0), 0) / papers.length;
    if (avgCitations > 20) score += 10;
    else if (avgCitations > 10) score += 5;

    return Math.min(score, 100);
}

function extractBankingTags(papers: any[], bankingTags: BankingTag[]): string[] {
    const allPaperTags = papers.flatMap((p: any) => p.tags.map((pt: any) => pt.tag.name));
    const bankingTagNames = new Set(bankingTags.map(bt => bt.name));
    
    const relevantTags = allPaperTags.filter((tag: string) => bankingTagNames.has(tag));
    return [...new Set(relevantTags)];
}

function generateBankingUseCases(technology: string, riskDomain: string, _bankingTags: string[]): string[] {
    const useCases: string[] = [];
    
    const useCaseMap: Record<string, string[]> = {
        'LLM Applications': [
            'Regulatory document analysis',
            'Compliance rule interpretation',
            'Risk reporting automation',
            'Customer query handling',
            'Contract review and analysis'
        ],
        'Graph Neural Networks': [
            'AML transaction network analysis',
            'Fraud detection in transaction graphs',
            'Credit risk network modeling',
            'Entity relationship mapping'
        ],
        'Deep Learning': [
            'Credit scoring and underwriting',
            'Fraud detection and prevention',
            'Market risk prediction',
            'Customer churn prediction'
        ],
        'NLP Compliance': [
            'Regulatory document classification',
            'Compliance rule extraction',
            'Audit report analysis',
            'Regulatory change monitoring'
        ],
        'Anomaly Detection': [
            'Fraud detection in transactions',
            'AML suspicious activity monitoring',
            'Operational anomaly identification',
            'Cyber threat detection'
        ],
        'Graph Analytics': [
            'Money laundering network detection',
            'Transaction pattern analysis',
            'Counterparty risk assessment',
            'Market liquidity analysis'
        ],
        'Predictive Modeling': [
            'Credit default prediction',
            'Market risk forecasting',
            'Customer churn prediction',
            'Operational risk modeling'
        ]
    };

    for (const [tech, cases] of Object.entries(useCaseMap)) {
        if (technology.includes(tech)) {
            useCases.push(...cases);
            break;
        }
    }

    const domainSpecific: Record<string, string[]> = {
        'Credit Risk': ['Credit scoring models', 'Default prediction', 'Loan underwriting', 'Portfolio risk assessment'],
        'Market Risk': ['VaR calculation', 'Stress testing', 'Portfolio optimization', 'Market sentiment analysis'],
        'Operational Risk': ['Process automation', 'Operational loss prediction', 'Efficiency improvement'],
        'Cyber Risk': ['Threat detection', 'Security incident response', 'Vulnerability assessment'],
        'Regulatory Risk': ['Compliance monitoring', 'Regulatory change tracking', 'Audit automation'],
        'Fraud Detection': ['Transaction fraud', 'Identity fraud', 'Account takeover'],
        'Compliance': ['KYC automation', 'AML monitoring', 'Sanctions screening']
    };

    if (domainSpecific[riskDomain]) {
        useCases.push(...domainSpecific[riskDomain]);
    }

    return [...new Set(useCases)].slice(0, 5);
}

function inferBankAdoption(papers: any[]): string[] {
    const banks: Set<string> = new Set();
    const bankKeywords = [
        'JPMorgan', 'Chase', 'Bank of America', 'Wells Fargo', 'Citibank',
        'Goldman Sachs', 'Morgan Stanley', 'HSBC', 'Barclays', 'Deutsche Bank',
        'UBS', 'Credit Suisse', 'BNP Paribas', 'Santander', 'ING',
        'BBVA', 'Standard Chartered', 'Royal Bank of Scotland', 'TD Bank', 'Scotiabank'
    ];

    for (const paper of papers) {
        const text = `${paper.title} ${paper.abstract || ''}`.toLowerCase();
        for (const bank of bankKeywords) {
            if (text.includes(bank.toLowerCase())) {
                banks.add(bank);
            }
        }
    }

    return Array.from(banks);
}

function extractMaturityIndicators(papers: any[]): string[] {
    const indicators: string[] = [];
    const text = papers.map((p: any) => `${p.title} ${p.abstract || ''}`).join(' ').toLowerCase();

    if (text.includes('production') || text.includes('implemented') || text.includes('deployed')) {
        indicators.push('Production deployment');
    }
    if (text.includes('pilot') || text.includes('poc') || text.includes('trial')) {
        indicators.push('Pilot implementation');
    }
    if (text.includes('regulatory approval') || text.includes('compliance')) {
        indicators.push('Regulatory compliance');
    }
    if (text.includes('scalable') || text.includes('enterprise-scale')) {
        indicators.push('Enterprise scalability');
    }
    if (text.includes('case study') || text.includes('real-world')) {
        indicators.push('Real-world validation');
    }
    if (text.includes('industry adoption') || text.includes('commercial')) {
        indicators.push('Industry adoption');
    }

    return [...new Set(indicators)];
}

export async function savePoCRecommendation(recommendation: PoCRecommendation): Promise<void> {
    // Could save to database if we had a PoCRecommendations table
    logger.debug(`PoC Recommendation: ${recommendation.title}`);
}

export async function getRecentPoCRecommendations(_days: number = 30): Promise<PoCRecommendation[]> {
    // Placeholder - would fetch from database
    return [];
}