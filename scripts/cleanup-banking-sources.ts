import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning up broken banking news sources...');

  // These sources are broken and should be removed
  const brokenSources = ['Finextra', 'Banking Dive', 'Financial Times Banking'];

  for (const sourceName of brokenSources) {
    try {
      const deleted = await prisma.source.deleteMany({
        where: { 
          name: sourceName,
          type: 'news'
        }
      });
      
      if (deleted.count > 0) {
        console.log(`  ✓ Removed ${sourceName}`);
      } else {
        console.log(`  - ${sourceName} not found (already removed)`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to remove ${sourceName}:`, error);
    }
  }

  console.log('\n📊 Current banking news sources:');
  const remainingSources = await prisma.source.findMany({
    where: { type: 'news' },
    orderBy: { name: 'asc' }
  });

  remainingSources.forEach((source: typeof remainingSources[0]) => {
    console.log(`  ✅ ${source.name}: ${source.url}`);
  });

  console.log(`\n✅ Cleanup complete! ${remainingSources.length} working banking news sources.`);
}

main()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
