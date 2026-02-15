export enum RiskDomain {
    CREDIT_RISK = 'credit-risk',
    MARKET_RISK = 'market-risk',
    OPERATIONAL_RISK = 'operational-risk',
    LIQUIDITY_RISK = 'liquidity-risk',
    CYBER_RISK = 'cyber-risk',
    MODEL_RISK = 'model-risk',
    REGULATORY_RISK = 'regulatory-risk'
}

export enum AIApplication {
    PREDICTIVE_MODELING = 'predictive-modeling',
    NLP_COMPLIANCE = 'nlp-compliance',
    ANOMALY_DETECTION = 'anomaly-detection',
    LLM_APPLICATIONS = 'llm-applications',
    GRAPH_ANALYTICS = 'graph-analytics',
    COMPUTER_VISION = 'computer-vision',
    TIME_SERIES = 'time-series',
    REINFORCEMENT_LEARNING = 'reinforcement-learning'
}

export enum TechnologyReadiness {
    EMERGING = 'emerging',
    PILOT_READY = 'pilot-ready',
    PRODUCTION = 'production',
    MATURE = 'mature'
}

export enum Priority {
    CRITICAL = 'critical',
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low'
}

export enum BusinessArea {
    TRADING = 'trading',
    COMPLIANCE = 'compliance',
    FRAUD_DETECTION = 'fraud-detection',
    CLIENT_ANALYTICS = 'client-analytics',
    RISK_MANAGEMENT = 'risk-management',
    CREDIT_SCORING = 'credit-scoring',
    AML_MONITORING = 'aml-monitoring',
    CUSTOMER_SERVICE = 'customer-service'
}

export interface BankingTaxonomy {
    id: string;
    name: string;
    category: 'Risk Domain' | 'AI Application' | 'Technology Readiness' | 'Priority' | 'Business Area';
    tags: string[];
    description: string;
}

export const BANKING_TAXONOMY: BankingTaxonomy[] = [
    {
        id: 'td-001',
        name: 'Credit Risk Assessment',
        category: 'Risk Domain',
        tags: ['Credit Risk', 'Risk Assessment', 'Default Prediction'],
        description: 'Models and approaches for assessing creditworthiness and default risk'
    },
    {
        id: 'td-002',
        name: 'Market Risk Analysis',
        category: 'Risk Domain',
        tags: ['Market Risk', 'Value at Risk', 'Portfolio Management'],
        description: 'Techniques for measuring and managing market and portfolio risk'
    },
    {
        id: 'td-003',
        name: 'Operational Risk',
        category: 'Risk Domain',
        tags: ['Operational Risk', 'Efficiency', 'Automation'],
        description: 'AI applications for improving operational efficiency and reducing risk'
    },
    {
        id: 'td-004',
        name: 'Cybersecurity',
        category: 'Risk Domain',
        tags: ['Cyber Risk', 'Security', 'Fraud Detection'],
        description: 'Technologies for detecting and preventing cyber threats'
    },
    {
        id: 'td-005',
        name: 'Regulatory Compliance',
        category: 'Risk Domain',
        tags: ['Regulatory', 'Compliance', 'Governance'],
        description: 'AI tools for ensuring regulatory compliance and governance'
    },
    {
        id: 'td-006',
        name: 'AML Monitoring',
        category: 'Risk Domain',
        tags: ['AML', 'Anti-Money Laundering', 'Transaction Monitoring'],
        description: 'Systems for detecting money laundering and suspicious transactions'
    },
    {
        id: 'td-007',
        name: 'Fraud Detection',
        category: 'AI Application',
        tags: ['Fraud Detection', 'Anomaly Detection', 'Pattern Recognition'],
        description: 'Machine learning models for identifying fraudulent activities'
    },
    {
        id: 'td-008',
        name: 'Credit Scoring',
        category: 'AI Application',
        tags: ['Credit Scoring', 'Risk Prediction', 'Loan Assessment'],
        description: 'Automated credit scoring and loan risk assessment'
    },
    {
        id: 'td-009',
        name: 'NLP for Compliance',
        category: 'AI Application',
        tags: ['NLP', 'Document Processing', 'Compliance'],
        description: 'Natural language processing for regulatory document analysis'
    },
    {
        id: 'td-010',
        name: 'Customer Analytics',
        category: 'AI Application',
        tags: ['Customer Analytics', 'Churn Prediction', 'Personalization'],
        description: 'AI-driven customer insights and behavior analysis'
    },
    {
        id: 'td-011',
        name: 'Deep Learning',
        category: 'AI Application',
        tags: ['Deep Learning', 'Neural Networks', 'Deep Models'],
        description: 'Advanced neural network architectures for complex problems'
    },
    {
        id: 'td-012',
        name: 'LLM Applications',
        category: 'AI Application',
        tags: ['LLM Applications', 'Large Language Models', 'Generative AI'],
        description: 'Applications of large language models in banking'
    },
    {
        id: 'td-013',
        name: 'Graph Analytics',
        category: 'AI Application',
        tags: ['Graph Analytics', 'Knowledge Graphs', 'Network Analysis'],
        description: 'Graph-based approaches for relationship and risk analysis'
    },
    {
        id: 'td-014',
        name: 'Time Series Analysis',
        category: 'AI Application',
        tags: ['Time Series', 'Forecasting', 'Sequential Data'],
        description: 'Time series models for forecasting and trend analysis'
    },
    {
        id: 'td-015',
        name: 'Emerging Tech',
        category: 'Technology Readiness',
        tags: ['Emerging', 'Research Phase', 'Experimental'],
        description: 'Technologies in early research or experimental phase'
    },
    {
        id: 'td-016',
        name: 'Pilot Ready',
        category: 'Technology Readiness',
        tags: ['Pilot', 'Trial', 'PoC Ready'],
        description: 'Technologies ready for proof-of-concept or pilot projects'
    },
    {
        id: 'td-017',
        name: 'Production Ready',
        category: 'Technology Readiness',
        tags: ['Production', 'Implemented', 'Deployed'],
        description: 'Technologies mature enough for production deployment'
    },
    {
        id: 'td-018',
        name: 'Mature Tech',
        category: 'Technology Readiness',
        tags: ['Mature', 'Established', 'Standard'],
        description: 'Well-established technologies with industry adoption'
    },
    {
        id: 'td-019',
        name: 'Trading & Markets',
        category: 'Business Area',
        tags: ['Trading', 'Markets', 'Investment Banking'],
        description: 'Applications in trading, investment banking, and markets'
    },
    {
        id: 'td-020',
        name: 'Compliance & Regulation',
        category: 'Business Area',
        tags: ['Compliance', 'Regulation', 'Legal'],
        description: 'Tools for regulatory compliance and legal documentation'
    },
    {
        id: 'td-021',
        name: 'Risk Management',
        category: 'Business Area',
        tags: ['Risk Management', 'Enterprise Risk', 'Risk Governance'],
        description: 'Enterprise-wide risk management applications'
    }
];

export interface TaxonomyClassification {
    riskDomain?: RiskDomain;
    aiApplication?: AIApplication;
    readiness?: TechnologyReadiness;
    priority?: Priority;
    businessArea?: BusinessArea;
    confidence: number;
}

export function classifyPaperWithTaxonomy(
    title: string,
    abstract: string | null,
    existingTags: string[]
): TaxonomyClassification {
    const text = `${title} ${abstract || ''}`.toLowerCase();
    const classification: TaxonomyClassification = {
        confidence: 0
    };

    classification.riskDomain = classifyRiskDomain(text, existingTags);
    classification.aiApplication = classifyAIApplication(text, existingTags);
    classification.readiness = classifyReadiness(text, existingTags);
    classification.priority = classifyPriority(text, classification);
    classification.businessArea = classifyBusinessArea(text, existingTags);

    const hasClassification = classification.riskDomain ||
                          classification.aiApplication ||
                          classification.readiness;

    classification.confidence = hasClassification ? 0.7 : 0.3;

    return classification;
}

function classifyRiskDomain(text: string, _tags: string[]): RiskDomain | undefined {
    const riskKeywords: Record<RiskDomain, string[]> = {
        [RiskDomain.CREDIT_RISK]: ['credit', 'default', 'loan', 'lending', 'borrower', 'scoring'],
        [RiskDomain.MARKET_RISK]: ['market', 'portfolio', 'trading', 'var', 'value-at-risk'],
        [RiskDomain.OPERATIONAL_RISK]: ['operational', 'efficiency', 'process', 'automation'],
        [RiskDomain.LIQUIDITY_RISK]: ['liquidity', 'funding', 'cash flow'],
        [RiskDomain.CYBER_RISK]: ['cyber', 'security', 'hack', 'attack', 'malware'],
        [RiskDomain.MODEL_RISK]: ['model risk', 'governance', 'validation', 'backtesting'],
        [RiskDomain.REGULATORY_RISK]: ['regulatory', 'compliance', 'basel', 'ecb', 'fca']
    };

    for (const [domain, keywords] of Object.entries(riskKeywords)) {
        if (keywords.some(kw => text.includes(kw))) {
            return domain as RiskDomain;
        }
    }

    return undefined;
}

function classifyAIApplication(text: string, _tags: string[]): AIApplication | undefined {
    const appKeywords: Record<AIApplication, string[]> = {
        [AIApplication.PREDICTIVE_MODELING]: ['predict', 'forecast', 'prediction', 'regression'],
        [AIApplication.NLP_COMPLIANCE]: ['nlp', 'language', 'text', 'document', 'compliance'],
        [AIApplication.ANOMALY_DETECTION]: ['anomaly', 'outlier', 'detect', 'fraud'],
        [AIApplication.LLM_APPLICATIONS]: ['llm', 'language model', 'gpt', 'chatgpt', 'generative'],
        [AIApplication.GRAPH_ANALYTICS]: ['graph', 'network', 'relationship', 'knowledge graph'],
        [AIApplication.COMPUTER_VISION]: ['vision', 'image', 'video', 'computer vision'],
        [AIApplication.TIME_SERIES]: ['time series', 'temporal', 'sequential', 'trend'],
        [AIApplication.REINFORCEMENT_LEARNING]: ['reinforcement', 'rl', 'policy', 'agent']
    };

    for (const [app, keywords] of Object.entries(appKeywords)) {
        if (keywords.some(kw => text.includes(kw))) {
            return app as AIApplication;
        }
    }

    return undefined;
}

function classifyReadiness(text: string, _tags: string[]): TechnologyReadiness | undefined {
    if (text.includes('research') || text.includes('experimental') || text.includes('novel')) {
        return TechnologyReadiness.EMERGING;
    }
    if (text.includes('pilot') || text.includes('poc') || text.includes('prototype')) {
        return TechnologyReadiness.PILOT_READY;
    }
    if (text.includes('production') || text.includes('implemented') || text.includes('deployed')) {
        return TechnologyReadiness.PRODUCTION;
    }
    if (text.includes('mature') || text.includes('established') || text.includes('standard')) {
        return TechnologyReadiness.MATURE;
    }

    return undefined;
}

function classifyPriority(text: string, classification: TaxonomyClassification): Priority {
    let score = 0;

    if (classification.riskDomain) score += 1;
    if (classification.aiApplication) score += 1;
    if (text.includes('critical') || text.includes('urgent') || text.includes('important')) {
        score += 1;
    }

    if (score >= 3) return Priority.CRITICAL;
    if (score >= 2) return Priority.HIGH;
    if (score === 1) return Priority.MEDIUM;
    return Priority.LOW;
}

function classifyBusinessArea(text: string, _tags: string[]): BusinessArea | undefined {
    const areaKeywords: Record<BusinessArea, string[]> = {
        [BusinessArea.TRADING]: ['trading', 'market', 'investment', 'securities'],
        [BusinessArea.COMPLIANCE]: ['compliance', 'regulatory', 'aml', 'kyc'],
        [BusinessArea.FRAUD_DETECTION]: ['fraud', 'money laundering', 'suspicious'],
        [BusinessArea.CLIENT_ANALYTICS]: ['customer', 'client', 'churn', 'personalization'],
        [BusinessArea.RISK_MANAGEMENT]: ['risk', 'enterprise risk', 'risk governance'],
        [BusinessArea.CREDIT_SCORING]: ['credit', 'scoring', 'loan'],
        [BusinessArea.AML_MONITORING]: ['aml', 'money laundering', 'transaction'],
        [BusinessArea.CUSTOMER_SERVICE]: ['customer service', 'support', 'chatbot']
    };

    for (const [area, keywords] of Object.entries(areaKeywords)) {
        if (keywords.some(kw => text.includes(kw))) {
            return area as BusinessArea;
        }
    }

    return undefined;
}

export function getTaxonomySuggestions(text: string): string[] {
    const suggestions: string[] = [];

    for (const item of BANKING_TAXONOMY) {
        if (item.tags.some(tag => text.toLowerCase().includes(tag.toLowerCase()))) {
            suggestions.push(item.name);
        }
    }

    return [...new Set(suggestions)].slice(0, 5);
}