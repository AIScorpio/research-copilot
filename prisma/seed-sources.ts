import { PrismaClient } from '@prisma/client';
import sourceTypesConfig from '../config/source-types.json';

const prisma = new PrismaClient();

interface SystemSource {
  name: string;
  displayName: string;
  description: string;
  url: string;
  enabled: boolean;
  hasCollector: boolean | 'proxy';
}

interface SourceType {
  id: string;
  displayName: string;
  systemSources: SystemSource[];
}

async function main() {
  console.log('Seeding system sources...');

  const sourceTypes = sourceTypesConfig.sourceTypes as SourceType[];
  
  for (const sourceType of sourceTypes) {
    console.log(`\nProcessing source type: ${sourceType.displayName}`);
    
    for (const sysSource of sourceType.systemSources) {
      // Try to find by name (case-insensitive) or displayName
      const existingSource = await prisma.source.findFirst({
        where: {
          OR: [
            { name: { equals: sysSource.name.toLowerCase() } },
            { displayName: { equals: sysSource.displayName } }
          ]
        }
      });

      if (existingSource) {
        console.log(`  Updating existing source: ${sysSource.name} (${existingSource.name})`);
        await prisma.source.update({
          where: { id: existingSource.id },
          data: {
            displayName: sysSource.displayName,
            type: sourceType.id,
            enabled: sysSource.enabled,
            url: sysSource.url,
          }
        });
      } else {
        console.log(`  Creating new source: ${sysSource.name}`);
        await prisma.source.create({
          data: {
            name: sysSource.name.toLowerCase(),
            displayName: sysSource.displayName,
            type: sourceType.id,
            enabled: sysSource.enabled,
            url: sysSource.url,
            requiresAuth: false,
          }
        });
      }
    }
  }

  console.log('\nSeeding completed!');
  
  const allSources = await prisma.source.findMany({
    orderBy: [{ type: 'asc' }, { name: 'asc' }]
  });
  
  console.log('\nCurrent sources in database:');
  console.log('='.repeat(60));
  
  let currentType = '';
  for (const source of allSources) {
    if (source.type !== currentType) {
      currentType = source.type;
      console.log(`\n[${currentType}]`);
    }
    const status = source.enabled ? '✅' : '❌';
    console.log(`  ${status} ${source.displayName || source.name}`);
  }
}

main()
  .catch((e) => {
    console.error('Error seeding sources:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
