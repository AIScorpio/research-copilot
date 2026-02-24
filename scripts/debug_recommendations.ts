import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debug() {
  console.log('=== Debug: Recent Papers ===');
  
  const recentPapers = await prisma.paper.findMany({
    where: {
      publicationDate: {
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      }
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

  console.log(`Found ${recentPapers.length} recent papers:`);
  
  for (const paper of recentPapers) {
    console.log(`\n- ${paper.title}`);
    console.log(`  Date: ${paper.publicationDate.toISOString()}`);
    const tagNames = paper.tags.map(pt => pt.tag.name);
    console.log(`  Tags: [${tagNames.join(', ')}]`);
  }

  const bankingTags = await prisma.tag.findMany({
    where: {
      category: 'business-area'
    }
  });
  
  console.log(`\n=== Banking Tags ===`);
  console.log(`Found ${bankingTags.length} banking tags:`);
  bankingTags.forEach(tag => {
    console.log(`  - ${tag.name} (category: ${tag.category || 'none'})`);
  });

  await prisma.$disconnect();
}

debug();
