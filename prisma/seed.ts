import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding academic collection sources...');

    // Academic Research Sources
    const academicSources = [
        { name: 'arxiv', url: 'https://export.arxiv.org/api/query', type: 'academic' },
        { name: 'semantic-scholar', url: 'https://api.semanticscholar.org/graph/v1', type: 'academic' },
        { name: 'ssrn', url: 'https://papers.ssrn.com', type: 'academic' },
        { name: 'ieee', url: 'https://api.semanticscholar.org/graph/v1', type: 'academic' },
        { name: 'acm', url: 'https://api.semanticscholar.org/graph/v1', type: 'academic' },
    ];

    // Insert academic sources
    for (const source of academicSources) {
        await prisma.source.upsert({
            where: { name: source.name },
            update: {},
            create: source,
        });
        console.log(`  ✓ Added academic source: ${source.name}`);
    }

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
