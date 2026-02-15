import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding banking and regulatory sources...');

    // Banking News Sources (updated to working RSS feeds)
    const bankingSources = [
        { name: 'American Banker', url: 'https://www.americanbanker.com/rss', type: 'news' },
        { name: 'CNBC Banking', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', type: 'news' },
        { name: 'Bankless Times', url: 'https://www.banklesstimes.com/feed/', type: 'news' },
        { name: 'Pymnts.com', url: 'https://www.pymnts.com/feed', type: 'news' },
    ];

    // Regulatory Sources
    const regulatorySources = [
        { name: 'BIS (Bank for International Settlements)', url: 'https://www.bis.org/pressreleases.xml', type: 'regulatory' },
        { name: 'ECB (European Central Bank)', url: 'https://www.ecb.europa.eu/rss/pr.html', type: 'regulatory' },
        { name: 'FCA (Financial Conduct Authority)', url: 'https://www.fca.org.uk/news/rss', type: 'regulatory' },
        { name: 'PRA (Prudential Regulation Authority)', url: 'https://www.bankofengland.co.uk/-/media/boe/files/pra/rss/pra-rss.xml', type: 'regulatory' },
        { name: 'Federal Reserve', url: 'https://www.federalreserve.gov/feeds/press_all.xml', type: 'regulatory' },
    ];

    // Social Media Sources
    const socialSources = [
        { name: 'Reddit', url: 'https://www.reddit.com', type: 'social', requiresAuth: true },
        { name: 'LinkedIn', url: 'https://www.linkedin.com', type: 'social', requiresAuth: true },
        { name: 'Twitter/X', url: 'https://x.com', type: 'social', requiresAuth: true },
    ];

    // Banking-specific taxonomy - Risk Categories
    const riskTags = [
        { name: 'Credit Risk', type: 'Banking', category: 'credit-risk' },
        { name: 'Market Risk', type: 'Banking', category: 'market-risk' },
        { name: 'Operational Risk', type: 'Banking', category: 'operational-risk' },
        { name: 'Liquidity Risk', type: 'Banking', category: 'liquidity-risk' },
        { name: 'Cyber Risk', type: 'Banking', category: 'cyber-risk' },
    ];

    // Banking-specific taxonomy - AI Applications
    const aiTags = [
        { name: 'Predictive Modeling', type: 'Banking', category: 'predictive-modeling' },
        { name: 'NLP Compliance', type: 'Banking', category: 'nlp-compliance' },
        { name: 'Anomaly Detection', type: 'Banking', category: 'anomaly-detection' },
        { name: 'LLM Applications', type: 'Banking', category: 'llm-applications' },
        { name: 'Graph Analytics', type: 'Banking', category: 'graph-analytics' },
    ];

    // Banking-specific taxonomy - Regulatory Topics
    const regulatoryTags = [
        { name: 'Model Governance', type: 'Banking', category: 'model-governance' },
        { name: 'AI Ethics', type: 'Banking', category: 'ai-ethics' },
        { name: 'Data Privacy', type: 'Banking', category: 'data-privacy' },
        { name: 'Basel Compliance', type: 'Banking', category: 'basel-compliance' },
    ];

    // Banking-specific taxonomy - Business Areas
    const businessTags = [
        { name: 'Trading', type: 'Banking', category: 'trading' },
        { name: 'Compliance', type: 'Banking', category: 'compliance' },
        { name: 'Fraud Detection', type: 'Banking', category: 'fraud-detection' },
        { name: 'Client Analytics', type: 'Banking', category: 'client-analytics' },
    ];

    // Insert banking news sources
    for (const source of bankingSources) {
        await prisma.source.upsert({
            where: { name: source.name },
            update: {},
            create: source,
        });
        console.log(`  ✓ Added banking source: ${source.name}`);
    }

    // Insert regulatory sources
    for (const source of regulatorySources) {
        await prisma.source.upsert({
            where: { name: source.name },
            update: {},
            create: source,
        });
        console.log(`  ✓ Added regulatory source: ${source.name}`);
    }

    // Insert social media sources
    for (const source of socialSources) {
        await prisma.source.upsert({
            where: { name: source.name },
            update: {},
            create: source,
        });
        console.log(`  ✓ Added social source: ${source.name}`);
    }

    // Insert all banking tags
    const allTags = [...riskTags, ...aiTags, ...regulatoryTags, ...businessTags];
    for (const tag of allTags) {
        await prisma.tag.upsert({
            where: { name: tag.name },
            update: {},
            create: tag,
        });
    }
    console.log(`  ✓ Added ${allTags.length} banking-specific tags`);

    console.log('\n✅ Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
