import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding academic collection sources...');

    // STEP 1: Delete all existing sources to start fresh
    const deleted = await prisma.source.deleteMany({});
    console.log(`  🗑️  Deleted ${deleted.count} existing sources`);

    // STEP 2: Academic Research Sources (only these 5)
    const academicSources = [
        { name: 'arxiv', url: 'https://export.arxiv.org/api/query', type: 'academic' },
        { name: 'semantic-scholar', url: 'https://api.semanticscholar.org/graph/v1', type: 'academic' },
        { name: 'ssrn', url: 'https://papers.ssrn.com', type: 'academic' },
        { name: 'ieee', url: 'https://api.semanticscholar.org/graph/v1', type: 'academic' },
        { name: 'acm', url: 'https://api.semanticscholar.org/graph/v1', type: 'academic' },
    ];

    // STEP 3: Insert only academic sources
    for (const source of academicSources) {
        await prisma.source.create({
            data: source,
        });
        console.log(`  ✓ Added academic source: ${source.name}`);
    }

    console.log('\n✅ Seeding complete! Total sources: 5');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
